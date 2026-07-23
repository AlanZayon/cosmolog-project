use async_trait::async_trait;
use time::OffsetDateTime;

use crate::infra::aws::{sign_request, AwsCredentials};
use crate::infra::http_client::build_http_client;

/// Stores uploaded image objects (production: Amazon S3; local: MinIO).
#[async_trait]
pub trait ObjectStorage: Send + Sync {
    async fn put_object(
        &self,
        key: &str,
        bytes: Vec<u8>,
        content_type: &str,
    ) -> Result<(), String>;
}

/// Amazon S3 / MinIO storage via the REST API (SigV4).
///
/// Without `endpoint`, uses AWS virtual-hosted style
/// (`{bucket}.s3.{region}.amazonaws.com/{key}`).
/// With `endpoint` (MinIO), uses path-style
/// (`{endpoint}/{bucket}/{key}`).
pub struct S3Storage {
    http: reqwest::Client,
    credentials: AwsCredentials,
    bucket: String,
    /// Custom endpoint base URL without trailing slash (e.g. `http://minio:9000`).
    endpoint: Option<String>,
}

impl S3Storage {
    pub fn new(credentials: AwsCredentials, bucket: String) -> Self {
        Self {
            http: build_http_client(),
            credentials,
            bucket,
            endpoint: None,
        }
    }

    pub fn with_endpoint(
        credentials: AwsCredentials,
        bucket: String,
        endpoint: String,
    ) -> Self {
        Self {
            http: build_http_client(),
            credentials,
            bucket,
            endpoint: Some(endpoint.trim_end_matches('/').to_string()),
        }
    }

    fn aws_host(&self) -> String {
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
        let (url, host, path) = if let Some(endpoint) = &self.endpoint {
            let endpoint_url = reqwest::Url::parse(endpoint)
                .map_err(|e| format!("invalid S3_ENDPOINT: {e}"))?;
            let host = endpoint_url
                .host_str()
                .ok_or_else(|| "S3_ENDPOINT missing host".to_string())?
                .to_string();
            let host_with_port = match endpoint_url.port() {
                Some(port) => format!("{host}:{port}"),
                None => host,
            };
            let path = format!("/{}/{}", self.bucket, key.trim_start_matches('/'));
            let url = format!("{endpoint}{path}");
            (url, host_with_port, path)
        } else {
            let host = self.aws_host();
            let path = format!("/{key}");
            let url = format!("https://{host}{path}");
            (url, host, path)
        };

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
            .put(&url)
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
            let body = response.text().await.unwrap_or_default();
            tracing::warn!(
                event = "storage.s3_error",
                status = %status,
                body = %body.chars().take(500).collect::<String>(),
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
