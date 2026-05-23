use anyhow::Result;
use async_trait::async_trait;

use super::AuthUser;

/// Validates bearer tokens into authenticated users (production: Supabase JWT via JWKS).
#[async_trait]
pub trait TokenValidator: Send + Sync {
    async fn validate(&self, token: &str) -> Result<AuthUser>;
}
