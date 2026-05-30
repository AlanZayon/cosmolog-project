use crate::error::AppError;

pub const DEFAULT_ICON: &str = "folder";

pub const ALLOWED_ICONS: &[&str] = &[
    "folder",
    "bookmark",
    "heart",
    "star",
    "book-open",
    "library",
    "sparkles",
    "moon",
    "sun",
    "flame",
    "compass",
    "globe",
    "music",
    "palette",
    "rocket",
    "crown",
    "gem",
    "coffee",
];

pub fn validate_icon(icon: &str) -> Result<(), AppError> {
    if ALLOWED_ICONS.contains(&icon) {
        Ok(())
    } else {
        Err(AppError::BadRequest(format!("invalid icon: {icon}")))
    }
}

pub fn resolved_icon(icon: Option<&str>) -> Result<&str, AppError> {
    match icon {
        None => Ok(DEFAULT_ICON),
        Some(s) => {
            let s = s.trim();
            if s.is_empty() {
                Ok(DEFAULT_ICON)
            } else {
                validate_icon(s)?;
                Ok(s)
            }
        }
    }
}
