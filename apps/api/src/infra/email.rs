use async_trait::async_trait;
use lettre::message::{Mailbox, MultiPart, SinglePart};
use lettre::transport::smtp::authentication::Credentials;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};
use serde_json::json;
use time::OffsetDateTime;

use crate::infra::aws::{sign_request, AwsCredentials};
use crate::infra::http_client::build_http_client;

/// Sends transactional auth emails (confirmation, password reset).
#[async_trait]
pub trait EmailSender: Send + Sync {
    async fn send(
        &self,
        to: &str,
        subject: &str,
        text_body: &str,
        html_body: &str,
    ) -> Result<(), String>;
}

/// Amazon SES v2 sender via the REST API (SigV4).
/// Credentials/region come from the standard AWS env vars
/// (`AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`).
pub struct SesEmailSender {
    http: reqwest::Client,
    credentials: AwsCredentials,
    from: String,
}

impl SesEmailSender {
    pub fn new(credentials: AwsCredentials, from: String) -> Self {
        Self {
            http: build_http_client(),
            credentials,
            from,
        }
    }
}

#[async_trait]
impl EmailSender for SesEmailSender {
    async fn send(
        &self,
        to: &str,
        subject: &str,
        text_body: &str,
        html_body: &str,
    ) -> Result<(), String> {
        let host = format!("email.{}.amazonaws.com", self.credentials.region);
        let path = "/v2/email/outbound-emails";

        let body = json!({
            "FromEmailAddress": self.from,
            "Destination": { "ToAddresses": [to] },
            "Content": {
                "Simple": {
                    "Subject": { "Data": subject, "Charset": "UTF-8" },
                    "Body": {
                        "Text": { "Data": text_body, "Charset": "UTF-8" },
                        "Html": { "Data": html_body, "Charset": "UTF-8" }
                    }
                }
            }
        });
        let payload = serde_json::to_vec(&body).map_err(|e| format!("ses payload: {e}"))?;

        let signed = sign_request(
            &self.credentials,
            "ses",
            "POST",
            &host,
            path,
            &payload,
            OffsetDateTime::now_utc(),
        );

        let mut request = self
            .http
            .post(format!("https://{host}{path}"))
            .header("content-type", "application/json");
        for (name, value) in signed.headers {
            request = request.header(name, value);
        }

        let response = request
            .body(payload)
            .send()
            .await
            .map_err(|e| format!("ses request failed: {e}"))?;

        let status = response.status();
        if !status.is_success() {
            tracing::warn!(
                event = "email.ses_error",
                status = %status,
                "ses send_email failed"
            );
            return Err(format!("ses send failed (status {status})"));
        }

        tracing::info!(event = "email.sent", subject = %subject, "transactional email sent");
        Ok(())
    }
}

/// SMTP sender for local/dev (Mailpit) or any SMTP relay.
pub struct SmtpEmailSender {
    mailer: AsyncSmtpTransport<Tokio1Executor>,
    from: Mailbox,
}

impl SmtpEmailSender {
    pub fn from_url(smtp_url: &str, from_address: &str) -> Result<Self, String> {
        let from: Mailbox = from_address
            .parse()
            .or_else(|_| format!("Cosmolog <{from_address}>").parse())
            .map_err(|e| format!("invalid SES_FROM_EMAIL / from address: {e}"))?;

        let url = smtp_url.trim();
        let without_scheme = url
            .strip_prefix("smtp://")
            .or_else(|| url.strip_prefix("smtps://"))
            .unwrap_or(url);
        let use_tls = url.starts_with("smtps://");

        let (auth_host, credentials) = if let Some((userinfo, hostport)) = without_scheme.split_once('@')
        {
            let (user, pass) = userinfo
                .split_once(':')
                .map(|(u, p)| (u.to_string(), p.to_string()))
                .unwrap_or((userinfo.to_string(), String::new()));
            (
                hostport.to_string(),
                Some(Credentials::new(user, pass)),
            )
        } else {
            (without_scheme.to_string(), None)
        };

        let builder = if use_tls {
            AsyncSmtpTransport::<Tokio1Executor>::relay(&auth_host.split(':').next().unwrap_or(&auth_host))
                .map_err(|e| format!("smtp relay: {e}"))?
        } else {
            // Mailpit and local relays: plain SMTP, no STARTTLS required.
            let host = auth_host.split(':').next().unwrap_or(&auth_host);
            let port: u16 = auth_host
                .split_once(':')
                .and_then(|(_, p)| p.parse().ok())
                .unwrap_or(25);
            AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(host).port(port)
        };

        let mailer = match credentials {
            Some(creds) => builder.credentials(creds).build(),
            None => builder.build(),
        };

        Ok(Self { mailer, from })
    }
}

#[async_trait]
impl EmailSender for SmtpEmailSender {
    async fn send(
        &self,
        to: &str,
        subject: &str,
        text_body: &str,
        html_body: &str,
    ) -> Result<(), String> {
        let to_mailbox: Mailbox = to
            .parse()
            .map_err(|e| format!("invalid recipient address: {e}"))?;

        let message = Message::builder()
            .from(self.from.clone())
            .to(to_mailbox)
            .subject(subject)
            .multipart(
                MultiPart::alternative()
                    .singlepart(SinglePart::plain(text_body.to_string()))
                    .singlepart(SinglePart::html(html_body.to_string())),
            )
            .map_err(|e| format!("smtp message build: {e}"))?;

        self.mailer
            .send(message)
            .await
            .map_err(|e| format!("smtp send failed: {e}"))?;

        tracing::info!(event = "email.sent", subject = %subject, via = "smtp", "transactional email sent");
        Ok(())
    }
}

/// Development/test fallback: logs that an email would have been sent.
/// Includes the text body so confirm/reset links are recoverable from API logs.
pub struct LogEmailSender;

#[async_trait]
impl EmailSender for LogEmailSender {
    async fn send(
        &self,
        to: &str,
        subject: &str,
        text_body: &str,
        _html_body: &str,
    ) -> Result<(), String> {
        tracing::warn!(
            event = "email.not_configured",
            to = %to,
            subject = %subject,
            body = %text_body,
            "SES/SMTP not configured; email was not sent (body logged for local recovery)"
        );
        Ok(())
    }
}
