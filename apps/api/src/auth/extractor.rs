use axum::{
    extract::FromRequestParts,
    http::{header::AUTHORIZATION, request::Parts},
};

use crate::auth::AuthUser;
use crate::error::AppError;
use crate::infra::logging::record_user_id;
use crate::state::AppState;

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<AuthUser, Self::Rejection> {
        let auth_header = parts
            .headers
            .get(AUTHORIZATION)
            .and_then(|value| value.to_str().ok())
            .ok_or(AppError::Unauthorized)?;

        let token = auth_header
            .strip_prefix("Bearer ")
            .map(str::trim)
            .filter(|t| !t.is_empty())
            .ok_or(AppError::Unauthorized)?;

        let mut user = state.jwt.validate(token).await.map_err(|err| {
            tracing::debug!(
                event = "auth.jwt_validation_failed",
                error = %err,
                "JWT validation failed"
            );
            AppError::Unauthorized
        })?;
        record_user_id(user.user_id);
        user.raw_token = Some(token.to_string());
        Ok(user)
    }
}
