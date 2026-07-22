use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("unauthorized: {0}")]
    Unauthorized(String),
    #[error("not found")]
    NotFound,
    #[error("bad request: {0}")]
    BadRequest(String),
    #[error("conflict: {0}")]
    Conflict(String),
    #[error("too many requests: {0}")]
    TooManyRequests(String),
    #[error("upstream error: {0}")]
    Upstream(String),
}

impl AppError {
    pub fn unauthorized() -> Self {
        AppError::Unauthorized("unauthorized".into())
    }

    pub fn from_db(err: sqlx::Error) -> Self {
        if let sqlx::Error::Database(db) = &err {
            if db.code().as_deref() == Some("23505") {
                return AppError::Conflict("resource already exists".to_string());
            }
        }
        AppError::Database(err)
    }

    fn error_kind(&self) -> &'static str {
        match self {
            AppError::Database(_) => "database",
            AppError::Unauthorized(_) => "unauthorized",
            AppError::NotFound => "not_found",
            AppError::BadRequest(_) => "bad_request",
            AppError::Conflict(_) => "conflict",
            AppError::TooManyRequests(_) => "too_many_requests",
            AppError::Upstream(_) => "upstream",
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let kind = self.error_kind();
        let (status, message) = match &self {
            AppError::Database(err) => {
                tracing::error!(
                    event = "error.database",
                    error_kind = kind,
                    error = %err,
                    "database request failed"
                );
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "internal server error".to_string(),
                )
            }
            AppError::Unauthorized(code) => {
                tracing::warn!(
                    event = "error.unauthorized",
                    error_kind = kind,
                    error_code = %code,
                    "unauthorized request"
                );
                (StatusCode::UNAUTHORIZED, code.clone())
            }
            AppError::NotFound => {
                tracing::warn!(
                    event = "error.not_found",
                    error_kind = kind,
                    "resource not found"
                );
                (StatusCode::NOT_FOUND, self.to_string())
            }
            AppError::BadRequest(msg) => {
                tracing::warn!(
                    event = "error.bad_request",
                    error_kind = kind,
                    error = %msg,
                    "bad request"
                );
                (StatusCode::BAD_REQUEST, msg.clone())
            }
            AppError::Conflict(msg) => {
                tracing::warn!(
                    event = "error.conflict",
                    error_kind = kind,
                    error = %msg,
                    "resource conflict"
                );
                (StatusCode::CONFLICT, msg.clone())
            }
            AppError::TooManyRequests(msg) => {
                tracing::warn!(
                    event = "error.too_many_requests",
                    error_kind = kind,
                    error = %msg,
                    "rate limited"
                );
                (StatusCode::TOO_MANY_REQUESTS, msg.clone())
            }
            AppError::Upstream(msg) => {
                tracing::warn!(
                    event = "error.upstream",
                    error_kind = kind,
                    error = %msg,
                    "upstream request failed"
                );
                let public = if msg
                    .chars()
                    .all(|c| c.is_ascii_lowercase() || c == '_')
                {
                    msg.clone()
                } else {
                    "service_unavailable".to_string()
                };
                (StatusCode::BAD_GATEWAY, public)
            }
        };

        let body = Json(json!({ "error": message }));
        (status, body).into_response()
    }
}

#[cfg(test)]
mod tests {
    use axum::http::StatusCode;
    use axum::response::IntoResponse;
    use http_body_util::BodyExt;

    use super::AppError;

    async fn response_for(err: AppError) -> (StatusCode, String) {
        let response = err.into_response();
        let status = response.status();
        let body = response.into_body();
        let bytes = body.collect().await.unwrap().to_bytes();
        let json: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        (status, json["error"].as_str().unwrap().to_string())
    }

    #[tokio::test]
    async fn unauthorized_returns_401() {
        let (status, msg) = response_for(AppError::unauthorized()).await;
        assert_eq!(status, StatusCode::UNAUTHORIZED);
        assert_eq!(msg, "unauthorized");
    }

    #[tokio::test]
    async fn not_found_returns_404() {
        let (status, _) = response_for(AppError::NotFound).await;
        assert_eq!(status, StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn bad_request_returns_400_with_message() {
        let (status, msg) = response_for(AppError::BadRequest("invalid title".into())).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_eq!(msg, "invalid title");
    }

    #[tokio::test]
    async fn conflict_returns_409() {
        let (status, msg) = response_for(AppError::Conflict("duplicate".into())).await;
        assert_eq!(status, StatusCode::CONFLICT);
        assert_eq!(msg, "duplicate");
    }

    #[tokio::test]
    async fn too_many_requests_returns_429_with_message() {
        let (status, msg) = response_for(AppError::TooManyRequests("wait 24 seconds".into())).await;
        assert_eq!(status, StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(msg, "wait 24 seconds");
    }

    #[tokio::test]
    async fn database_returns_500() {
        let err = AppError::from_db(sqlx::Error::RowNotFound);
        let (status, msg) = response_for(err).await;
        assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(msg, "internal server error");
    }

    #[tokio::test]
    async fn upstream_returns_sanitized_502() {
        let (status, msg) =
            response_for(AppError::Upstream("supabase internal detail".into())).await;
        assert_eq!(status, StatusCode::BAD_GATEWAY);
        assert_eq!(msg, "service_unavailable");

        let (status, msg) = response_for(AppError::Upstream("service_unavailable".into())).await;
        assert_eq!(status, StatusCode::BAD_GATEWAY);
        assert_eq!(msg, "service_unavailable");
    }
}
