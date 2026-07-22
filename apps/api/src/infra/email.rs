use async_trait::async_trait;
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

/// Development/test fallback: logs that an email would have been sent.
/// Never logs the body (it contains one-time token links).
pub struct LogEmailSender;

#[async_trait]
impl EmailSender for LogEmailSender {
    async fn send(
        &self,
        to: &str,
        subject: &str,
        _text_body: &str,
        _html_body: &str,
    ) -> Result<(), String> {
        tracing::warn!(
            event = "email.not_configured",
            to = %to,
            subject = %subject,
            "SES_FROM_EMAIL not configured; email was not sent"
        );
        Ok(())
    }
}
