use axum::extract::State;
use axum::Json;

use crate::auth::AuthUser;
use crate::error::AppError;
use crate::infra::supabase::{AuthSession, RefreshRequest, SignInRequest, SignUpRequest};
use crate::state::AppState;
use serde::Serialize;
use uuid::Uuid;

#[derive(Serialize)]
pub struct MeResponse {
    pub user_id: Uuid,
    pub role: String,
    pub email: Option<String>,
}

pub async fn me(user: AuthUser) -> Json<MeResponse> {
    Json(MeResponse {
        user_id: user.user_id,
        role: user.role,
        email: user.email,
    })
}

pub async fn sign_in(
    State(state): State<AppState>,
    Json(body): Json<SignInRequest>,
) -> Result<Json<AuthSession>, AppError> {
    let session = state
        .supabase
        .sign_in(body)
        .await
        .map_err(auth_error)?;
    tracing::info!(
        event = "auth.sign_in",
        user_id = %session.user.id,
        "user signed in"
    );
    Ok(Json(session))
}

pub async fn sign_up(
    State(state): State<AppState>,
    Json(body): Json<SignUpRequest>,
) -> Result<Json<AuthSession>, AppError> {
    let session = state
        .supabase
        .sign_up(body)
        .await
        .map_err(auth_error)?;
    tracing::info!(
        event = "auth.sign_up",
        user_id = %session.user.id,
        "user signed up"
    );
    Ok(Json(session))
}

pub async fn refresh(
    State(state): State<AppState>,
    Json(body): Json<RefreshRequest>,
) -> Result<Json<AuthSession>, AppError> {
    let session = state
        .supabase
        .refresh(body)
        .await
        .map_err(auth_error)?;
    tracing::info!(
        event = "auth.refresh",
        user_id = %session.user.id,
        "session refreshed"
    );
    Ok(Json(session))
}

fn auth_error(message: String) -> AppError {
    let lower = message.to_lowercase();
    if lower.contains("invalid login")
        || lower.contains("invalid credentials")
        || lower.contains("invalid grant")
    {
        AppError::Unauthorized
    } else {
        AppError::Upstream(message)
    }
}
