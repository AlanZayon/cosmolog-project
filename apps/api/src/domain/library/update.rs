use serde::Deserialize;

use crate::error::AppError;

use super::create::MAX_DESCRIPTION_LEN;
use super::icons;

#[derive(Debug, Deserialize)]
pub struct UpdateCollectionInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub icon: Option<String>,
}

impl UpdateCollectionInput {
    pub fn validate(&self) -> Result<(), AppError> {
        if let Some(name) = &self.name {
            let n = name.trim();
            if n.is_empty() {
                return Err(AppError::BadRequest("name cannot be empty".into()));
            }
            if n.len() > 200 {
                return Err(AppError::BadRequest(
                    "name must be at most 200 characters".into(),
                ));
            }
        }
        if let Some(desc) = &self.description {
            if desc.len() > MAX_DESCRIPTION_LEN {
                return Err(AppError::BadRequest(format!(
                    "description must be at most {MAX_DESCRIPTION_LEN} characters"
                )));
            }
        }
        if let Some(icon) = &self.icon {
            icons::validate_icon(icon.trim())?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::UpdateCollectionInput;
    use crate::error::AppError;

    #[test]
    fn accepts_name_update() {
        let input = UpdateCollectionInput {
            name: Some("Renamed".into()),
            description: None,
            icon: None,
        };
        assert!(input.validate().is_ok());
    }

    #[test]
    fn rejects_empty_name_update() {
        let input = UpdateCollectionInput {
            name: Some(" ".into()),
            description: None,
            icon: None,
        };
        assert!(matches!(input.validate(), Err(AppError::BadRequest(_))));
    }
}
