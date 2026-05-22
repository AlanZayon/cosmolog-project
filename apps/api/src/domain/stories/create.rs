use serde::Deserialize;

use crate::error::AppError;

const ALLOWED_TYPES: &[&str] = &["short_story", "chapters", "comic"];

#[derive(Debug, Deserialize)]
pub struct CreateStoryInput {
    pub title: String,
    pub description: Option<String>,
    pub tags: Option<Vec<String>>,
    pub r#type: String,
    pub universe_id: Option<uuid::Uuid>,
    pub arc_id: Option<uuid::Uuid>,
    pub cover_image_url: Option<String>,
    pub content: Option<String>,
}

impl CreateStoryInput {
    pub fn validate(&self) -> Result<(), AppError> {
        let title = self.title.trim();
        if title.is_empty() {
            return Err(AppError::BadRequest("title is required".into()));
        }
        if title.len() > 200 {
            return Err(AppError::BadRequest("title must be at most 200 characters".into()));
        }
        if !ALLOWED_TYPES.contains(&self.r#type.as_str()) {
            return Err(AppError::BadRequest("invalid story type".into()));
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
