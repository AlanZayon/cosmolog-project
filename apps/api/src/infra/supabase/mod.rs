mod auth;
mod rest;
mod storage;

use std::sync::Arc;

use crate::infra::http_client::build_http_client;

pub use auth::{AuthSession, RefreshRequest, SignInRequest, SignUpRequest};
pub use storage::StorageUploadResponse;

#[derive(Clone)]
pub struct SupabaseClient {
    pub url: String,
    pub anon_key: String,
    http: Arc<reqwest::Client>,
}

impl SupabaseClient {
    pub fn new(url: &str, anon_key: &str) -> Self {
        Self {
            url: url.trim_end_matches('/').to_string(),
            anon_key: anon_key.to_string(),
            http: Arc::new(build_http_client()),
        }
    }

    pub async fn sign_in(&self, req: SignInRequest) -> Result<AuthSession, String> {
        auth::sign_in(self, req).await
    }

    pub async fn sign_up(&self, req: SignUpRequest) -> Result<AuthSession, String> {
        auth::sign_up(self, req).await
    }

    pub async fn refresh(&self, req: RefreshRequest) -> Result<AuthSession, String> {
        auth::refresh(self, req).await
    }

    pub async fn get_feed(
        &self,
        access_token: Option<&str>,
        limit: i32,
    ) -> Result<serde_json::Value, String> {
        rest::get_feed(self, access_token, limit).await
    }

    pub async fn upload_object(
        &self,
        access_token: &str,
        bucket: &str,
        path: &str,
        bytes: Vec<u8>,
        content_type: &str,
    ) -> Result<StorageUploadResponse, String> {
        storage::upload(self, access_token, bucket, path, bytes, content_type).await
    }
}
