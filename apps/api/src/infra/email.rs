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

/// Connection settings parsed out of `SMTP_URL`.
#[derive(Debug, PartialEq, Eq)]
struct SmtpTarget {
    host: String,
    /// Explicit port from the URL; `None` falls back to the scheme default.
    port: Option<u16>,
    /// `smtps://` — implicit TLS (SMTPS), as opposed to plain `smtp://`.
    implicit_tls: bool,
    /// `(user, password)`; `None` for unauthenticated relays such as Mailpit.
    credentials: Option<(String, String)>,
}

/// Parses `smtp[s]://[user[:password]@]host[:port]`.
///
/// The userinfo is split on the *last* `@` because relays commonly use an email
/// address as the username (Gmail app passwords, Brevo, Mailgun).
fn parse_smtp_url(smtp_url: &str) -> SmtpTarget {
    let url = smtp_url.trim();
    let without_scheme = url
        .strip_prefix("smtp://")
        .or_else(|| url.strip_prefix("smtps://"))
        .unwrap_or(url);
    let implicit_tls = url.starts_with("smtps://");

    let (hostport, credentials) = match without_scheme.rsplit_once('@') {
        Some((userinfo, hostport)) => {
            let (user, pass) = userinfo
                .split_once(':')
                .map(|(u, p)| (u.to_string(), p.to_string()))
                .unwrap_or((userinfo.to_string(), String::new()));
            (hostport, Some((user, pass)))
        }
        None => (without_scheme, None),
    };

    let (host, port) = match hostport.split_once(':') {
        Some((host, port)) => (host, port.parse::<u16>().ok()),
        None => (hostport, None),
    };

    SmtpTarget {
        host: host.to_string(),
        port,
        implicit_tls,
        credentials,
    }
}

impl SmtpEmailSender {
    pub fn from_url(smtp_url: &str, from_address: &str) -> Result<Self, String> {
        let from: Mailbox = from_address
            .parse()
            .or_else(|_| format!("Cosmolog <{from_address}>").parse())
            .map_err(|e| format!("invalid SES_FROM_EMAIL / from address: {e}"))?;

        let target = parse_smtp_url(smtp_url);

        let mut builder = if target.implicit_tls {
            AsyncSmtpTransport::<Tokio1Executor>::relay(&target.host)
                .map_err(|e| format!("smtp relay: {e}"))?
        } else {
            // Mailpit and local relays: plain SMTP, no STARTTLS required.
            AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(&target.host)
                .port(target.port.unwrap_or(25))
        };

        // `relay()` defaults to 465; honour an explicit port for hosts that expose
        // SMTPS elsewhere (e.g. Resend on 2465 when 465 is blocked).
        if target.implicit_tls {
            if let Some(port) = target.port {
                builder = builder.port(port);
            }
        }

        let mailer = match target.credentials {
            Some((user, pass)) => builder.credentials(Credentials::new(user, pass)).build(),
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

#[cfg(test)]
mod tests {
    use super::{parse_smtp_url, SmtpTarget};

    #[test]
    fn parses_gmail_app_password_url() {
        assert_eq!(
            parse_smtp_url("smtps://alan@gmail.com:abcdefghijklmnop@smtp.gmail.com"),
            SmtpTarget {
                host: "smtp.gmail.com".into(),
                port: None,
                implicit_tls: true,
                credentials: Some(("alan@gmail.com".into(), "abcdefghijklmnop".into())),
            }
        );
    }

    #[test]
    fn keeps_at_sign_inside_password() {
        let target = parse_smtp_url("smtps://apikey:se@cr@et@smtp.sendgrid.net");
        assert_eq!(target.host, "smtp.sendgrid.net");
        assert_eq!(
            target.credentials,
            Some(("apikey".into(), "se@cr@et".into()))
        );
    }

    #[test]
    fn parses_explicit_port() {
        let target = parse_smtp_url("smtps://resend:key@smtp.resend.com:2465");
        assert_eq!(target.host, "smtp.resend.com");
        assert_eq!(target.port, Some(2465));
    }

    #[test]
    fn parses_unauthenticated_mailpit_url() {
        assert_eq!(
            parse_smtp_url("smtp://mailpit:1025"),
            SmtpTarget {
                host: "mailpit".into(),
                port: Some(1025),
                implicit_tls: false,
                credentials: None,
            }
        );
    }
}
