use serde::Deserialize;

use crate::error::AppError;

const ALLOWED_TYPES: &[&str] = &["short_story", "chapters", "comic"];

#[derive(Debug, Deserialize)]
pub struct UpdateStoryInput {
    pub title: Option<String>,
    pub description: Option<String>,
    pub tags: Option<Vec<String>>,
    pub r#type: Option<String>,
    pub universe_id: Option<Option<uuid::Uuid>>,
    pub arc_id: Option<Option<uuid::Uuid>>,
    pub cover_image_url: Option<Option<String>>,
    pub content: Option<Option<String>>,
}

impl UpdateStoryInput {
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
        if let Some(kind) = &self.r#type {
            if !ALLOWED_TYPES.contains(&kind.as_str()) {
                return Err(AppError::BadRequest("invalid story type".into()));
            }
        }
        if let Some(desc) = &self.description {
            if desc.len() > 5000 {
                return Err(AppError::BadRequest(
                    "description must be at most 5000 characters".into(),
                ));
            }
        }
        Ok(())
    }
}
