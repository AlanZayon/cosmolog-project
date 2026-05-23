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
    #[error("unauthorized")]
    Unauthorized,
    #[error("not found")]
    NotFound,
    #[error("bad request: {0}")]
    BadRequest(String),
    #[error("conflict: {0}")]
    Conflict(String),
    #[error("upstream error: {0}")]
    Upstream(String),
}

impl AppError {
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
            AppError::Unauthorized => "unauthorized",
            AppError::NotFound => "not_found",
            AppError::BadRequest(_) => "bad_request",
            AppError::Conflict(_) => "conflict",
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
                (StatusCode::INTERNAL_SERVER_ERROR, self.to_string())
            }
            AppError::Unauthorized => {
                tracing::warn!(
                    event = "error.unauthorized",
                    error_kind = kind,
                    "unauthorized request"
                );
                (StatusCode::UNAUTHORIZED, self.to_string())
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
            AppError::Upstream(msg) => {
                tracing::warn!(
                    event = "error.upstream",
                    error_kind = kind,
                    error = %msg,
                    "upstream request failed"
                );
                (StatusCode::BAD_GATEWAY, msg.clone())
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
        let (status, msg) = response_for(AppError::Unauthorized).await;
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
    async fn upstream_returns_502() {
        let (status, _) = response_for(AppError::Upstream("supabase down".into())).await;
        assert_eq!(status, StatusCode::BAD_GATEWAY);
    }

    #[tokio::test]
    async fn database_returns_500() {
        let err = AppError::from_db(sqlx::Error::RowNotFound);
        let (status, _) = response_for(err).await;
        assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
    }
}
