use serde::Deserialize;

use crate::error::AppError;

#[derive(Debug, Deserialize)]
pub struct UpdateUniverseInput {
    pub title: Option<String>,
    pub description: Option<String>,
    pub cover_image_url: Option<Option<String>>,
    pub codex_enabled: Option<bool>,
    pub saga_premise: Option<Option<String>>,
    pub default_calendar_label: Option<Option<String>>,
    pub afterword: Option<Option<String>>,
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

#[cfg(test)]
mod tests {
    use super::UpdateUniverseInput;
    use crate::error::AppError;

    #[test]
    fn accepts_title_update() {
        let input = UpdateUniverseInput {
            title: Some("Renamed".into()),
            description: None,
            cover_image_url: None,
            codex_enabled: None,
            saga_premise: None,
            default_calendar_label: None,
            afterword: None,
        };
        assert!(input.validate().is_ok());
    }

    #[test]
    fn rejects_empty_title_update() {
        let input = UpdateUniverseInput {
            title: Some(" ".into()),
            description: None,
            cover_image_url: None,
            codex_enabled: None,
            saga_premise: None,
            default_calendar_label: None,
            afterword: None,
        };
        assert!(matches!(input.validate(), Err(AppError::BadRequest(_))));
    }
}
