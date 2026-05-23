use axum::extract::{Multipart, State};
use axum::Json;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::error::AppError;
use crate::infra::supabase::StorageUploadResponse;
use crate::state::AppState;

const ALLOWED_BUCKETS: &[&str] = &[
    "avatars",
    "covers",
    "comics",
    "universe-covers",
    "arc-covers",
];

/// Upload a file to Supabase Storage (proxied with the user's JWT).
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
    let path = path.unwrap_or_else(|| format!("{}/{}.bin", user.user_id, Uuid::new_v4()));

    let token = user
        .raw_token
        .as_deref()
        .ok_or(AppError::Unauthorized)?;

    let response = state
        .supabase
        .upload_object(token, &bucket, &path, bytes, &content_type)
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

    Ok(Json(response))
}
