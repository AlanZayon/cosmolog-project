use crate::error::AppError;

const MAX_URL_LEN: usize = 2048;

const ALLOWED_BUCKETS: &[&str] = &[
    "avatars",
    "covers",
    "comics",
    "universe-covers",
    "arc-covers",
];

/// Validates that `url` points to a public object in this project's Supabase Storage.
pub fn validate_stored_image_url(url: &str, supabase_url: &str) -> Result<(), AppError> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return Err(AppError::BadRequest("image URL cannot be empty".into()));
    }
    if trimmed.len() > MAX_URL_LEN {
        return Err(AppError::BadRequest(format!(
            "image URL must be at most {MAX_URL_LEN} characters"
        )));
    }
    if trimmed.chars().any(char::is_control) {
        return Err(AppError::BadRequest(
            "image URL contains invalid characters".into(),
        ));
    }
    let lower = trimmed.to_ascii_lowercase();
    if lower.starts_with("javascript:") || lower.starts_with("data:") {
        return Err(AppError::BadRequest("invalid image URL scheme".into()));
    }
    if !trimmed.starts_with("https://") {
        return Err(AppError::BadRequest("image URL must use https".into()));
    }
    if trimmed.contains("..") {
        return Err(AppError::BadRequest("invalid image URL path".into()));
    }

    let base = supabase_url.trim_end_matches('/');
    let prefix = format!("{base}/storage/v1/object/public/");
    if !trimmed.starts_with(&prefix) {
        return Err(AppError::BadRequest(
            "image URL must be hosted on project storage".into(),
        ));
    }

    let rest = &trimmed[prefix.len()..];
    let Some((bucket, object_path)) = rest.split_once('/') else {
        return Err(AppError::BadRequest("invalid storage object path".into()));
    };
    if !ALLOWED_BUCKETS.contains(&bucket) {
        return Err(AppError::BadRequest("invalid storage bucket".into()));
    }
    if object_path.is_empty() || object_path.contains("..") {
        return Err(AppError::BadRequest("invalid storage object path".into()));
    }

    Ok(())
}

/// Validates an optional URL field on create (`None` skips validation).
pub fn validate_optional_stored_image_url(
    url: Option<&str>,
    supabase_url: &str,
) -> Result<(), AppError> {
    if let Some(value) = url {
        validate_stored_image_url(value, supabase_url)?;
    }
    Ok(())
}

/// Validates nullable update fields (`None` = omit, `Some(None)` = clear, `Some(Some(url))` = set).
pub fn validate_nullable_image_url_update(
    value: Option<&Option<String>>,
    supabase_url: &str,
) -> Result<(), AppError> {
    if let Some(inner) = value {
        if let Some(url) = inner {
            validate_stored_image_url(url, supabase_url)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const SUPABASE: &str = "https://abc123.supabase.co";

    fn valid_url(bucket: &str) -> String {
        format!("{SUPABASE}/storage/v1/object/public/{bucket}/user-id/file.png")
    }

    #[test]
    fn accepts_valid_storage_url() {
        assert!(validate_stored_image_url(&valid_url("avatars"), SUPABASE).is_ok());
    }

    #[test]
    fn rejects_non_https() {
        let url = valid_url("covers").replace("https://", "http://");
        assert!(matches!(
            validate_stored_image_url(&url, SUPABASE),
            Err(AppError::BadRequest(_))
        ));
    }

    #[test]
    fn rejects_wrong_host() {
        assert!(matches!(
            validate_stored_image_url(
                "https://evil.example/storage/v1/object/public/avatars/x/y.png",
                SUPABASE
            ),
            Err(AppError::BadRequest(_))
        ));
    }

    #[test]
    fn rejects_invalid_bucket() {
        assert!(matches!(
            validate_stored_image_url(&valid_url("private-bucket"), SUPABASE),
            Err(AppError::BadRequest(_))
        ));
    }

    #[test]
    fn rejects_path_traversal() {
        let mut url = valid_url("comics");
        url.push_str("/../secret");
        assert!(matches!(
            validate_stored_image_url(&url, SUPABASE),
            Err(AppError::BadRequest(_))
        ));
    }

    #[test]
    fn rejects_javascript_scheme() {
        assert!(matches!(
            validate_stored_image_url("javascript:alert(1)", SUPABASE),
            Err(AppError::BadRequest(_))
        ));
    }

    #[test]
    fn optional_none_is_ok() {
        assert!(validate_optional_stored_image_url(None, SUPABASE).is_ok());
    }

    #[test]
    fn nullable_clear_is_ok() {
        assert!(validate_nullable_image_url_update(Some(&None), SUPABASE).is_ok());
    }
}
