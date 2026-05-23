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

#[cfg(test)]
mod tests {
    use super::UpdateProfileInput;
    use crate::error::AppError;

    #[test]
    fn rejects_empty_username() {
        let input = UpdateProfileInput {
            username: Some("  ".into()),
            bio: None,
            avatar_url: None,
        };
        assert!(matches!(input.validate(), Err(AppError::BadRequest(_))));
    }

    #[test]
    fn rejects_username_with_control_chars() {
        let input = UpdateProfileInput {
            username: Some("bad\nname".into()),
            bio: None,
            avatar_url: None,
        };
        assert!(matches!(input.validate(), Err(AppError::BadRequest(_))));
    }

    #[test]
    fn rejects_bio_over_500_chars() {
        let input = UpdateProfileInput {
            username: None,
            bio: Some("b".repeat(501)),
            avatar_url: None,
        };
        assert!(matches!(input.validate(), Err(AppError::BadRequest(_))));
    }

    #[test]
    fn rejects_update_with_no_fields() {
        let input = UpdateProfileInput {
            username: None,
            bio: None,
            avatar_url: None,
        };
        assert!(matches!(input.validate(), Err(AppError::BadRequest(_))));
    }

    #[test]
    fn accepts_valid_username_update() {
        let input = UpdateProfileInput {
            username: Some("Alan".into()),
            bio: None,
            avatar_url: None,
        };
        let validated = input.validate().unwrap();
        assert_eq!(validated.username.as_deref(), Some("Alan"));
    }

    #[test]
    fn empty_avatar_url_becomes_none() {
        let input = UpdateProfileInput {
            username: None,
            bio: None,
            avatar_url: Some("  ".into()),
        };
        let validated = input.validate().unwrap();
        assert_eq!(validated.avatar_url, Some(None));
    }
}
