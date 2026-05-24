use std::collections::HashMap;
use std::sync::Arc;

use anyhow::{anyhow, Context, Result};
use async_trait::async_trait;
use jsonwebtoken::{decode, decode_header, Validation};
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::auth::claims::SupabaseClaims;
use crate::auth::jwks::{fetch_jwks, CachedKey};
use crate::auth::TokenValidator;
use crate::config::Config;
use crate::infra::http_client::build_http_client;

/// Authenticated Supabase user extracted from a valid JWT.
#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: Uuid,
    pub role: String,
    pub email: Option<String>,
    /// Original bearer token (set by the HTTP extractor for storage/feed proxy).
    pub raw_token: Option<String>,
}

pub struct JwtValidator {
    jwks_url: String,
    issuer: String,
    audience: String,
    client: reqwest::Client,
    keys: RwLock<HashMap<String, CachedKey>>,
}

impl JwtValidator {
    pub async fn new(config: &Config) -> Result<Arc<Self>> {
        let validator = Arc::new(Self {
            jwks_url: config.supabase_jwks_url.clone(),
            issuer: config.supabase_jwt_issuer.clone(),
            audience: config.supabase_jwt_audience.clone(),
            client: build_http_client(),
            keys: RwLock::new(HashMap::new()),
        });

        validator.refresh_keys().await?;
        tracing::info!(
            event = "auth.jwks_loaded",
            jwks_url = %validator.jwks_url,
            "loaded Supabase JWKS"
        );

        Ok(validator)
    }

    /// Pre-load JWKS keys without network (tests and local fixtures).
    pub fn with_preloaded_keys(
        issuer: impl Into<String>,
        audience: impl Into<String>,
        keys: HashMap<String, CachedKey>,
    ) -> Arc<Self> {
        Arc::new(Self {
            jwks_url: String::new(),
            issuer: issuer.into(),
            audience: audience.into(),
            client: build_http_client(),
            keys: RwLock::new(keys),
        })
    }

    /// Pre-load keys without fetching JWKS (unit tests in this crate).
    #[cfg(test)]
    pub fn with_keys(
        issuer: impl Into<String>,
        audience: impl Into<String>,
        keys: HashMap<String, CachedKey>,
    ) -> Arc<Self> {
        Self::with_preloaded_keys(issuer, audience, keys)
    }
}

#[async_trait]
impl TokenValidator for JwtValidator {
    async fn validate(&self, token: &str) -> Result<AuthUser> {
        self.validate_token(token).await
    }
}

impl JwtValidator {
    /// Core JWT validation (also used by the `TokenValidator` trait).
    pub async fn validate_token(&self, token: &str) -> Result<AuthUser> {
        let header = decode_header(token).context("invalid JWT header")?;
        let kid = header
            .kid
            .ok_or_else(|| anyhow!("JWT missing kid header"))?;

        let cached = self
            .key_for(kid.as_str())
            .await?
            .ok_or_else(|| anyhow!("unknown JWT kid: {kid}"))?;

        let mut validation = Validation::new(cached.algorithm);
        validation.set_issuer(&[self.issuer.as_str()]);
        validation.set_audience(&[self.audience.as_str()]);
        validation.validate_exp = true;

        let token_data = decode::<SupabaseClaims>(token, &cached.decoding_key, &validation)
            .context("JWT decode failed")?;

        let claims = token_data.claims;
        let role = claims.role.unwrap_or_else(|| "authenticated".to_string());
        if role != "authenticated" {
            return Err(anyhow!("invalid token role: {role}"));
        }

        Ok(AuthUser {
            user_id: claims.sub,
            role,
            email: claims.email,
            raw_token: None,
        })
    }

    async fn key_for(&self, kid: &str) -> Result<Option<CachedKey>> {
        if let Some(key) = self.keys.read().await.get(kid) {
            return Ok(Some(key.clone()));
        }

        self.refresh_keys().await?;

        Ok(self.keys.read().await.get(kid).cloned())
    }

    async fn refresh_keys(&self) -> Result<()> {
        let keys = fetch_jwks(&self.client, &self.jwks_url).await?;
        let mut map = HashMap::with_capacity(keys.len());
        for key in keys {
            map.insert(key.kid.clone(), key);
        }
        *self.keys.write().await = map;
        Ok(())
    }
}
