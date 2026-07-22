use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use anyhow::{anyhow, Result};
use async_trait::async_trait;
use uuid::Uuid;

use super::{AuthUser, TokenValidator};

/// Maps bearer tokens to users for HTTP/integration tests (no crypto).
pub struct MockTokenValidator {
    by_token: RwLock<HashMap<String, AuthUser>>,
    default_user: Option<AuthUser>,
}

impl MockTokenValidator {
    pub fn accepting(user_id: Uuid) -> Arc<Self> {
        Arc::new(Self {
            by_token: RwLock::new(HashMap::new()),
            default_user: Some(AuthUser {
                user_id,
                role: "authenticated".into(),
                email: Some("test@example.com".into()),
            }),
        })
    }

    pub fn rejecting() -> Arc<Self> {
        Arc::new(Self {
            by_token: RwLock::new(HashMap::new()),
            default_user: None,
        })
    }

    pub fn register_token(self: &Arc<Self>, token: &str, user: AuthUser) {
        self.by_token
            .write()
            .expect("mock jwt lock")
            .insert(token.to_string(), user);
    }
}

#[async_trait]
impl TokenValidator for MockTokenValidator {
    async fn validate(&self, token: &str) -> Result<AuthUser> {
        if let Some(user) = self.by_token.read().expect("mock jwt lock").get(token) {
            return Ok(user.clone());
        }
        if let Some(user) = &self.default_user {
            return Ok(user.clone());
        }
        Err(anyhow!("invalid token"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn accepts_any_token_when_default_user_set() {
        let validator = MockTokenValidator::accepting(Uuid::new_v4());
        let user = validator.validate("any-bearer").await.unwrap();
        assert_eq!(user.role, "authenticated");
    }

    #[tokio::test]
    async fn rejects_when_no_default_and_token_unknown() {
        let validator = MockTokenValidator::rejecting();
        assert!(validator.validate("bad").await.is_err());
    }

    #[tokio::test]
    async fn uses_per_token_mapping() {
        let id = Uuid::new_v4();
        let validator = MockTokenValidator::rejecting();
        validator.register_token(
            "secret",
            AuthUser {
                user_id: id,
                role: "authenticated".into(),
                email: None,
            },
        );
        let user = validator.validate("secret").await.unwrap();
        assert_eq!(user.user_id, id);
    }
}
