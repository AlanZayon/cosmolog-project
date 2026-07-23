use crate::error::AppError;

const MAX_URL_LEN: usize = 2048;

const ALLOWED_BUCKETS: &[&str] = &[
    "avatars",
    "covers",
    "comics",
    "universe-covers",
    "arc-covers",
];

/// Validates that `url` points to an object served by this project's image
/// storage. `allowed_prefixes` holds the configured public bases, each ending
/// with `/` and followed by `{bucket}/{object_path}` (S3/CloudFront, plus the
/// legacy Supabase prefix during the transition).
pub fn validate_stored_image_url(url: &str, allowed_prefixes: &[String]) -> Result<(), AppError> {
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
    if !trimmed.starts_with("https://") && !trimmed.starts_with("http://") {
        return Err(AppError::BadRequest(
            "image URL must use http or https".into(),
        ));
    }
    if trimmed.contains("..") {
        return Err(AppError::BadRequest("invalid image URL path".into()));
    }

    let rest = allowed_prefixes
        .iter()
        .find_map(|prefix| trimmed.strip_prefix(prefix.as_str()))
        .ok_or_else(|| {
            AppError::BadRequest("image URL must be hosted on project storage".into())
        })?;

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
    allowed_prefixes: &[String],
) -> Result<(), AppError> {
    if let Some(value) = url {
        validate_stored_image_url(value, allowed_prefixes)?;
    }
    Ok(())
}

/// Validates nullable update fields (`None` = omit, `Some(None)` = clear, `Some(Some(url))` = set).
pub fn validate_nullable_image_url_update(
    value: Option<&Option<String>>,
    allowed_prefixes: &[String],
) -> Result<(), AppError> {
    if let Some(inner) = value {
        if let Some(url) = inner {
            validate_stored_image_url(url, allowed_prefixes)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn prefixes() -> Vec<String> {
        vec![
            "https://cdn.cosmolog.example/".to_string(),
            "https://abc123.supabase.co/storage/v1/object/public/".to_string(),
        ]
    }

    fn valid_url(bucket: &str) -> String {
        format!("https://cdn.cosmolog.example/{bucket}/user-id/file.png")
    }

    #[test]
    fn accepts_valid_s3_url() {
        assert!(validate_stored_image_url(&valid_url("avatars"), &prefixes()).is_ok());
    }

    #[test]
    fn accepts_legacy_supabase_url() {
        let url = "https://abc123.supabase.co/storage/v1/object/public/covers/user-id/file.png";
        assert!(validate_stored_image_url(url, &prefixes()).is_ok());
    }

    #[test]
    fn rejects_http_when_only_https_prefix_configured() {
        let url = valid_url("covers").replace("https://", "http://");
        assert!(matches!(
            validate_stored_image_url(&url, &prefixes()),
            Err(AppError::BadRequest(_))
        ));
    }

    #[test]
    fn accepts_http_when_http_prefix_configured() {
        let prefixes = vec!["http://localhost:9000/cosmolog/".to_string()];
        let url = "http://localhost:9000/cosmolog/avatars/user-id/file.png";
        assert!(validate_stored_image_url(url, &prefixes).is_ok());
    }

    #[test]
    fn rejects_wrong_host() {
        assert!(matches!(
            validate_stored_image_url(
                "https://evil.example/avatars/x/y.png",
                &prefixes()
            ),
            Err(AppError::BadRequest(_))
        ));
    }

    #[test]
    fn rejects_invalid_bucket() {
        assert!(matches!(
            validate_stored_image_url(&valid_url("private-bucket"), &prefixes()),
            Err(AppError::BadRequest(_))
        ));
    }

    #[test]
    fn rejects_path_traversal() {
        let mut url = valid_url("comics");
        url.push_str("/../secret");
        assert!(matches!(
            validate_stored_image_url(&url, &prefixes()),
            Err(AppError::BadRequest(_))
        ));
    }

    #[test]
    fn rejects_javascript_scheme() {
        assert!(matches!(
            validate_stored_image_url("javascript:alert(1)", &prefixes()),
            Err(AppError::BadRequest(_))
        ));
    }

    #[test]
    fn rejects_when_no_prefix_configured() {
        assert!(matches!(
            validate_stored_image_url(&valid_url("avatars"), &[]),
            Err(AppError::BadRequest(_))
        ));
    }

    #[test]
    fn optional_none_is_ok() {
        assert!(validate_optional_stored_image_url(None, &prefixes()).is_ok());
    }

    #[test]
    fn nullable_clear_is_ok() {
        assert!(validate_nullable_image_url_update(Some(&None), &prefixes()).is_ok());
    }
}
