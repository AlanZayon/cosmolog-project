use crate::error::AppError;

pub const VISIBILITY_PUBLIC: &str = "public";
pub const VISIBILITY_PRIVATE: &str = "private";

pub fn validate_visibility(value: &str) -> Result<(), AppError> {
    if value == VISIBILITY_PUBLIC || value == VISIBILITY_PRIVATE {
        Ok(())
    } else {
        Err(AppError::BadRequest(
            "visibility must be 'public' or 'private'".into(),
        ))
    }
}

pub fn resolved_visibility(value: Option<&str>) -> Result<&'static str, AppError> {
    match value {
        None => Ok(VISIBILITY_PRIVATE),
        Some(v) => {
            let trimmed = v.trim();
            validate_visibility(trimmed)?;
            if trimmed == VISIBILITY_PUBLIC {
                Ok(VISIBILITY_PUBLIC)
            } else {
                Ok(VISIBILITY_PRIVATE)
            }
        }
    }
}

pub fn can_read_collection(
    collection_user_id: uuid::Uuid,
    visibility: &str,
    viewer_id: uuid::Uuid,
) -> bool {
    collection_user_id == viewer_id || visibility == VISIBILITY_PUBLIC
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn defaults_to_private() {
        assert_eq!(resolved_visibility(None).unwrap(), VISIBILITY_PRIVATE);
    }

    #[test]
    fn owner_can_read_private() {
        let owner = Uuid::new_v4();
        assert!(can_read_collection(owner, VISIBILITY_PRIVATE, owner));
    }

    #[test]
    fn other_cannot_read_private() {
        let owner = Uuid::new_v4();
        let other = Uuid::new_v4();
        assert!(!can_read_collection(owner, VISIBILITY_PRIVATE, other));
    }

    #[test]
    fn other_can_read_public() {
        let owner = Uuid::new_v4();
        let other = Uuid::new_v4();
        assert!(can_read_collection(owner, VISIBILITY_PUBLIC, other));
    }
}
