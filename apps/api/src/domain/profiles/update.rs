use serde::Deserialize;

use crate::error::AppError;

#[derive(Debug, Deserialize)]
pub struct UpdateProfileInput {
    pub username: Option<String>,
    pub bio: Option<String>,
    pub avatar_url: Option<String>,
}

impl UpdateProfileInput {
    pub fn validate(&self) -> Result<ValidatedUpdate, AppError> {
        let mut username = None;
        let mut bio = None;
        let mut avatar_url = None;

        if let Some(ref value) = self.username {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                return Err(AppError::BadRequest("username cannot be empty".into()));
            }
            if trimmed.len() > 50 {
                return Err(AppError::BadRequest(
                    "username must be at most 50 characters".into(),
                ));
            }
            if trimmed.chars().any(char::is_control) {
                return Err(AppError::BadRequest(
                    "username contains invalid characters".into(),
                ));
            }
            username = Some(trimmed.to_string());
        }

        if let Some(ref value) = self.bio {
            let trimmed = value.trim();
            if trimmed.len() > 500 {
                return Err(AppError::BadRequest("bio must be at most 500 characters".into()));
            }
            bio = Some(trimmed.to_string());
        }

        if let Some(ref value) = self.avatar_url {
            let trimmed = value.trim();
            if trimmed.len() > 2048 {
                return Err(AppError::BadRequest(
                    "avatar_url must be at most 2048 characters".into(),
                ));
            }
            avatar_url = Some(if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            });
        }

        if username.is_none() && bio.is_none() && avatar_url.is_none() {
            return Err(AppError::BadRequest(
                "at least one field must be provided".into(),
            ));
        }

        Ok(ValidatedUpdate {
            username,
            bio,
            avatar_url,
        })
    }
}

#[derive(Debug)]
pub struct ValidatedUpdate {
    pub username: Option<String>,
    pub bio: Option<String>,
    pub avatar_url: Option<Option<String>>,
}
