use serde::Deserialize;
use uuid::Uuid;

use crate::error::AppError;

#[derive(Debug, Deserialize)]
pub struct ReorderCollectionStoriesInput {
    pub story_ids: Vec<Uuid>,
}

impl ReorderCollectionStoriesInput {
    pub fn validate(&self) -> Result<(), AppError> {
        if self.story_ids.is_empty() {
            return Err(AppError::BadRequest("story_ids cannot be empty".into()));
        }
        Ok(())
    }
}
