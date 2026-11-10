use axum::{
    extract::{Multipart, State},
    Json,
};
use serde::Serialize;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::domain::limits::MAX_UPLOAD_BYTES;
use crate::error::AppError;
use crate::state::AppState;

const ALLOWED_BUCKETS: &[&str] = &[
    "avatars",
    "covers",
    "comics",
    "universe-covers",
    "arc-covers",
    "codex-covers",
    "codex-maps",
    "codex-gallery",
];

const ALLOWED_IMAGE_TYPES: &[&str] = &["image/jpeg", "image/png", "image/webp", "image/gif"];

#[derive(Debug, Serialize)]
pub struct StorageUploadResponse {
    pub path: String,
    pub public_url: String,
}

/// Upload a file to Amazon S3 under `{bucket}/{user_id}/{filename}`.
pub async fn upload(
    State(state): State<AppState>,
    user: AuthUser,
    mut multipart: Multipart,
) -> Result<Json<StorageUploadResponse>, AppError> {
    let mut bucket: Option<String> = None;
    let mut path: Option<String> = None;
    let mut file_bytes: Option<Vec<u8>> = None;
    let mut content_type = "application/octet-stream".to_string();

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(e.to_string()))?
    {
        let name = field.name().unwrap_or_default().to_string();
        match name.as_str() {
            "bucket" => {
                bucket = Some(
                    field
                        .text()
                        .await
                        .map_err(|e| AppError::BadRequest(e.to_string()))?,
                );
            }
            "path" => {
                path = Some(
                    field
                        .text()
                        .await
                        .map_err(|e| AppError::BadRequest(e.to_string()))?,
                );
            }
            "file" => {
                content_type = field
                    .content_type()
                    .map(str::to_string)
                    .unwrap_or_else(|| "application/octet-stream".to_string());
                file_bytes = Some(
                    field
                        .bytes()
                        .await
                        .map_err(|e| AppError::BadRequest(e.to_string()))?
                        .to_vec(),
                );
            }
            _ => {}
        }
    }

    let bucket = bucket.ok_or_else(|| AppError::BadRequest("bucket is required".into()))?;
    if !ALLOWED_BUCKETS.contains(&bucket.as_str()) {
        return Err(AppError::BadRequest("invalid storage bucket".into()));
    }
    let bytes = file_bytes.ok_or_else(|| AppError::BadRequest("file is required".into()))?;
    if bytes.len() > MAX_UPLOAD_BYTES {
        return Err(AppError::BadRequest(format!(
            "file exceeds maximum size of {} bytes",
            MAX_UPLOAD_BYTES
        )));
    }
    if !ALLOWED_IMAGE_TYPES.contains(&content_type.as_str()) {
        return Err(AppError::BadRequest("unsupported file content type".into()));
    }

    let public_base = state
        .storage_settings
        .public_base_url
        .clone()
        .ok_or_else(|| AppError::Upstream("storage_not_configured".into()))?;

    let path = storage_path(user.user_id, path)?;
    let key = format!("{bucket}/{path}");

    state
        .storage
        .put_object(&key, bytes, &content_type)
        .await
        .map_err(AppError::Upstream)?;

    tracing::info!(
        event = "storage.uploaded",
        user_id = %user.user_id,
        bucket = %bucket,
        path = %path,
        content_type = %content_type,
        "file uploaded to storage"
    );

    Ok(Json(StorageUploadResponse {
        public_url: format!("{public_base}/{key}"),
        path,
    }))
}

fn storage_path(user_id: Uuid, client_path: Option<String>) -> Result<String, AppError> {
    let filename = match client_path {
        Some(raw) => {
            let trimmed = raw.trim();
            if trimmed.is_empty()
                || trimmed.contains("..")
                || trimmed.starts_with('/')
                || trimmed.contains('\\')
            {
                return Err(AppError::BadRequest("invalid storage path".into()));
            }
            trimmed
                .split('/')
                .next_back()
                .filter(|segment| !segment.is_empty())
                .ok_or_else(|| AppError::BadRequest("invalid storage path".into()))?
                .to_string()
        }
        None => format!("{}.bin", Uuid::new_v4()),
    };

    if filename.contains('/') || filename.contains('\\') {
        return Err(AppError::BadRequest("invalid storage path".into()));
    }

    Ok(format!("{user_id}/{filename}"))
}

#[cfg(test)]
mod tests {
    use super::storage_path;
    use uuid::Uuid;

    #[test]
    fn builds_user_scoped_path_from_client_filename() {
        let user_id = Uuid::new_v4();
        let path = storage_path(user_id, Some("photo.png".into())).expect("path");
        assert_eq!(path, format!("{user_id}/photo.png"));
    }

    #[test]
    fn strips_foreign_prefix_from_client_path() {
        let user_id = Uuid::new_v4();
        let other = Uuid::new_v4();
        let path = storage_path(user_id, Some(format!("{other}/photo.png"))).expect("path");
        assert_eq!(path, format!("{user_id}/photo.png"));
    }

    #[test]
    fn rejects_path_traversal() {
        let user_id = Uuid::new_v4();
        assert!(storage_path(user_id, Some("../secret.png".into())).is_err());
    }
}
