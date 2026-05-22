use serde::Deserialize;

use crate::error::AppError;

#[derive(Debug, Deserialize)]
pub struct UpdateUniverseInput {
    pub title: Option<String>,
    pub description: Option<String>,
    pub cover_image_url: Option<Option<String>>,
}

impl UpdateUniverseInput {
    pub fn validate(&self) -> Result<(), AppError> {
        if let Some(title) = &self.title {
            let t = title.trim();
            if t.is_empty() {
                return Err(AppError::BadRequest("title cannot be empty".into()));
            }
            if t.len() > 200 {
                return Err(AppError::BadRequest(
                    "title must be at most 200 characters".into(),
                ));
            }
        }
        Ok(())
    }
}
