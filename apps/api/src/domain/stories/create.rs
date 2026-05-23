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

#[cfg(test)]
mod tests {
    use super::CreateStoryInput;
    use crate::error::AppError;

    fn sample_input(title: &str, story_type: &str) -> CreateStoryInput {
        CreateStoryInput {
            title: title.into(),
            description: None,
            tags: None,
            r#type: story_type.into(),
            universe_id: None,
            arc_id: None,
            cover_image_url: None,
            content: None,
        }
    }

    #[test]
    fn accepts_valid_input() {
        assert!(sample_input("My Story", "short_story").validate().is_ok());
    }

    #[test]
    fn rejects_empty_title() {
        let err = sample_input("   ", "short_story").validate().unwrap_err();
        assert!(matches!(err, AppError::BadRequest(_)));
    }

    #[test]
    fn rejects_title_over_200_chars() {
        let err = sample_input(&"a".repeat(201), "chapters").validate().unwrap_err();
        assert!(matches!(err, AppError::BadRequest(_)));
    }

    #[test]
    fn rejects_invalid_story_type() {
        let err = sample_input("Title", "novel").validate().unwrap_err();
        assert!(matches!(err, AppError::BadRequest(_)));
    }

    #[test]
    fn accepts_all_allowed_types() {
        for kind in ["short_story", "chapters", "comic"] {
            assert!(sample_input("T", kind).validate().is_ok());
        }
    }

    #[test]
    fn rejects_description_over_5000_chars() {
        let mut input = sample_input("Title", "short_story");
        input.description = Some("x".repeat(5001));
        assert!(matches!(input.validate(), Err(AppError::BadRequest(_))));
    }

    #[test]
    fn title_trims_whitespace() {
        let input = sample_input("  Hello  ", "short_story");
        assert_eq!(input.title(), "Hello");
    }
}
