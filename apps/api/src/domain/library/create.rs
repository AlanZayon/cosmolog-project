use serde::Deserialize;

use crate::error::AppError;

pub const MAX_DESCRIPTION_LEN: usize = 280;

#[derive(Debug, Deserialize)]
pub struct CreateCollectionInput {
    pub name: String,
    pub description: Option<String>,
    pub icon: Option<String>,
}

impl CreateCollectionInput {
    pub fn validate(&self) -> Result<(), AppError> {
        let name = self.name.trim();
        if name.is_empty() {
            return Err(AppError::BadRequest("name is required".into()));
        }
        if name.len() > 200 {
            return Err(AppError::BadRequest(
                "name must be at most 200 characters".into(),
            ));
        }
        if let Some(desc) = &self.description {
            if desc.len() > MAX_DESCRIPTION_LEN {
                return Err(AppError::BadRequest(format!(
                    "description must be at most {MAX_DESCRIPTION_LEN} characters"
                )));
            }
        }
        super::icons::resolved_icon(self.icon.as_deref())?;
        Ok(())
    }

    pub fn name(&self) -> &str {
        self.name.trim()
    }

    pub fn description(&self) -> Option<&str> {
        self.description
            .as_ref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
    }

    pub fn icon(&self) -> Result<&str, AppError> {
        super::icons::resolved_icon(self.icon.as_deref())
    }
}

#[cfg(test)]
mod tests {
    use super::CreateCollectionInput;
    use crate::error::AppError;

    #[test]
    fn accepts_valid_name() {
        let input = CreateCollectionInput {
            name: "Favorites".into(),
            description: None,
            icon: None,
        };
        assert!(input.validate().is_ok());
    }

    #[test]
    fn rejects_empty_name() {
        let input = CreateCollectionInput {
            name: " ".into(),
            description: None,
            icon: None,
        };
        assert!(matches!(input.validate(), Err(AppError::BadRequest(_))));
    }
}
