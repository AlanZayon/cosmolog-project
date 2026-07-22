use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::{anyhow, Context, Result};
use async_trait::async_trait;
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use uuid::Uuid;

use crate::auth::claims::AccessClaims;
use crate::auth::TokenValidator;
use crate::config::{Config, ACCESS_TOKEN_TTL_SECONDS};

pub const JWT_ISSUER: &str = "cosmolog-api";
pub const JWT_AUDIENCE: &str = "authenticated";

/// Authenticated user extracted from a valid access token.
#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: Uuid,
    pub role: String,
    pub email: Option<String>,
}

/// Issues and validates this API's own HS256 access tokens.
pub struct JwtSigner {
    encoding_key: EncodingKey,
    decoding_key: DecodingKey,
    ttl_seconds: i64,
}

impl JwtSigner {
    pub fn new(config: &Config) -> Self {
        Self::from_secret(config.auth_jwt_secret.as_bytes())
    }

    pub fn from_secret(secret: &[u8]) -> Self {
        Self {
            encoding_key: EncodingKey::from_secret(secret),
            decoding_key: DecodingKey::from_secret(secret),
            ttl_seconds: ACCESS_TOKEN_TTL_SECONDS,
        }
    }

    fn now_unix() -> i64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock before unix epoch")
            .as_secs() as i64
    }

    /// Signs an access token; returns the token and its TTL in seconds.
    pub fn sign(&self, user_id: Uuid, email: Option<&str>) -> Result<(String, i64)> {
        let now = Self::now_unix();
        let claims = AccessClaims {
            sub: user_id,
            aud: JWT_AUDIENCE.to_string(),
            iss: JWT_ISSUER.to_string(),
            exp: now + self.ttl_seconds,
            iat: now,
            role: "authenticated".to_string(),
            email: email.map(str::to_string),
        };
        let token = encode(&Header::new(Algorithm::HS256), &claims, &self.encoding_key)
            .context("failed to sign access token")?;
        Ok((token, self.ttl_seconds))
    }

    pub fn validate_token(&self, token: &str) -> Result<AuthUser> {
        let mut validation = Validation::new(Algorithm::HS256);
        validation.set_issuer(&[JWT_ISSUER]);
        validation.set_audience(&[JWT_AUDIENCE]);
        validation.validate_exp = true;

        let token_data = decode::<AccessClaims>(token, &self.decoding_key, &validation)
            .context("JWT decode failed")?;

        let claims = token_data.claims;
        if claims.role != "authenticated" {
            return Err(anyhow!("invalid token role: {}", claims.role));
        }

        Ok(AuthUser {
            user_id: claims.sub,
            role: claims.role,
            email: claims.email,
        })
    }
}

#[async_trait]
impl TokenValidator for JwtSigner {
    async fn validate(&self, token: &str) -> Result<AuthUser> {
        self.validate_token(token)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn signer() -> JwtSigner {
        JwtSigner::from_secret(b"test-jwt-secret-test-jwt-secret-0123456789")
    }

    #[test]
    fn signs_and_validates_roundtrip() {
        let signer = signer();
        let user_id = Uuid::new_v4();
        let (token, expires_in) = signer.sign(user_id, Some("a@b.com")).expect("sign");
        assert_eq!(expires_in, ACCESS_TOKEN_TTL_SECONDS);

        let user = signer.validate_token(&token).expect("validate");
        assert_eq!(user.user_id, user_id);
        assert_eq!(user.role, "authenticated");
        assert_eq!(user.email.as_deref(), Some("a@b.com"));
    }

    #[test]
    fn rejects_token_signed_with_other_secret() {
        let other = JwtSigner::from_secret(b"another-secret-another-secret-0123456789");
        let (token, _) = other.sign(Uuid::new_v4(), None).expect("sign");
        assert!(signer().validate_token(&token).is_err());
    }

    #[test]
    fn rejects_garbage_token() {
        assert!(signer().validate_token("not-a-jwt").is_err());
    }
}
