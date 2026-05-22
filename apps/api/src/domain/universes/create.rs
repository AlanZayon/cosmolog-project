use serde::Deserialize;

use crate::error::AppError;

#[derive(Debug, Deserialize)]
pub struct CreateUniverseInput {
    pub title: String,
    pub description: Option<String>,
    pub cover_image_url: Option<String>,
}

impl CreateUniverseInput {
    pub fn validate(&self) -> Result<(), AppError> {
        let title = self.title.trim();
        if title.is_empty() {
            return Err(AppError::BadRequest("title is required".into()));
        }
        if title.len() > 200 {
            return Err(AppError::BadRequest("title must be at most 200 characters".into()));
        }
        if let Some(desc) = &self.description {
            if desc.len() > 2000 {
                return Err(AppError::BadRequest(
                    "description must be at most 2000 characters".into(),
                ));
            }
        }
        Ok(())
    }

    pub fn title(&self) -> &str {
        self.title.trim()
    }

    pub fn description(&self) -> Option<&str> {
        self.description
            .as_ref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
    }
}
