use async_trait::async_trait;
use time::OffsetDateTime;

use crate::infra::aws::{sign_request, AwsCredentials};
use crate::infra::http_client::build_http_client;

/// Stores uploaded image objects (production: Amazon S3).
#[async_trait]
pub trait ObjectStorage: Send + Sync {
    async fn put_object(
        &self,
        key: &str,
        bytes: Vec<u8>,
        content_type: &str,
    ) -> Result<(), String>;
}

/// Amazon S3 storage via the REST API (SigV4, virtual-hosted style).
/// Public reads should be served by the bucket policy or CloudFront
/// (`S3_PUBLIC_BASE_URL`).
pub struct S3Storage {
    http: reqwest::Client,
    credentials: AwsCredentials,
    bucket: String,
}

impl S3Storage {
    pub fn new(credentials: AwsCredentials, bucket: String) -> Self {
        Self {
            http: build_http_client(),
            credentials,
            bucket,
        }
    }

    fn host(&self) -> String {
        format!("{}.s3.{}.amazonaws.com", self.bucket, self.credentials.region)
    }
}

#[async_trait]
impl ObjectStorage for S3Storage {
    async fn put_object(
        &self,
        key: &str,
        bytes: Vec<u8>,
        content_type: &str,
    ) -> Result<(), String> {
        let host = self.host();
        let path = format!("/{key}");
        let signed = sign_request(
            &self.credentials,
            "s3",
            "PUT",
            &host,
            &path,
            &bytes,
            OffsetDateTime::now_utc(),
        );

        let mut request = self
            .http
            .put(format!("https://{host}{path}"))
            .header("content-type", content_type)
            .header("cache-control", "public, max-age=31536000, immutable");
        for (name, value) in signed.headers {
            request = request.header(name, value);
        }

        let response = request
            .body(bytes)
            .send()
            .await
            .map_err(|e| format!("s3 put_object request failed: {e}"))?;

        let status = response.status();
        if !status.is_success() {
            // S3 error bodies are XML without secrets, but keep logs terse.
            tracing::warn!(
                event = "storage.s3_error",
                status = %status,
                "s3 put_object failed"
            );
            return Err(format!("s3 put_object failed (status {status})"));
        }
        Ok(())
    }
}

/// Used when S3 is not configured (local dev without AWS credentials).
pub struct DisabledStorage;

#[async_trait]
impl ObjectStorage for DisabledStorage {
    async fn put_object(
        &self,
        _key: &str,
        _bytes: Vec<u8>,
        _content_type: &str,
    ) -> Result<(), String> {
        Err("storage_not_configured".to_string())
    }
}
