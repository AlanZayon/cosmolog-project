use axum::{
    extract::FromRequestParts,
    http::{header::AUTHORIZATION, request::Parts},
};

use crate::auth::AuthUser;
use crate::error::AppError;
use crate::infra::logging::record_user_id;
use crate::state::AppState;

/// Optional JWT: no header → anonymous; valid header → user + raw token for upstream proxy.
pub struct OptionalAuth {
    #[allow(dead_code)]
    pub user: Option<AuthUser>,
    pub token: Option<String>,
}

impl FromRequestParts<AppState> for OptionalAuth {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let Some(auth_header) = parts.headers.get(AUTHORIZATION) else {
            return Ok(OptionalAuth {
                user: None,
                token: None,
            });
        };
        let Some(token) = auth_header
            .to_str()
            .ok()
            .and_then(|value| value.strip_prefix("Bearer "))
            .map(str::trim)
            .filter(|t| !t.is_empty())
            .map(str::to_string)
        else {
            return Ok(OptionalAuth {
                user: None,
                token: None,
            });
        };

        let user = state.jwt.validate(&token).await.map_err(|err| {
            tracing::debug!(
                event = "auth.jwt_validation_failed",
                error = %err,
                "JWT validation failed"
            );
            AppError::Unauthorized
        })?;
        record_user_id(user.user_id);
        Ok(OptionalAuth {
            user: Some(user),
            token: Some(token),
        })
    }
}
