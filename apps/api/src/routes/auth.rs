use axum::extract::State;
use axum::Json;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::domain::auth::service::{self, AuthContext, SignUpInput};
use crate::domain::auth::{AuthFlowError, AuthSession, SignUpOutcome};
use crate::error::AppError;
use crate::state::AppState;

fn auth_context(state: &AppState) -> AuthContext<'_> {
    AuthContext {
        pool: &state.pool,
        signer: &state.signer,
        email: state.email.as_ref(),
        app_public_url: &state.auth.app_public_url,
        require_email_confirmation: state.auth.require_email_confirmation,
    }
}

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

#[derive(Deserialize)]
pub struct SignInRequest {
    pub email: String,
    pub password: String,
}

pub async fn sign_in(
    State(state): State<AppState>,
    Json(body): Json<SignInRequest>,
) -> Result<Json<AuthSession>, AppError> {
    let session = service::sign_in(&auth_context(&state), &body.email, &body.password)
        .await
        .map_err(auth_error)?;
    tracing::info!(
        event = "auth.sign_in",
        user_id = %session.user.id,
        "user signed in"
    );
    Ok(Json(session))
}

#[derive(Deserialize)]
pub struct SignUpRequest {
    pub email: String,
    pub password: String,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub full_name: Option<String>,
    /// Accepted for backwards compatibility; not stored.
    #[serde(default)]
    #[allow(dead_code)]
    pub date_of_birth: Option<String>,
}

#[derive(Serialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum SignUpResponse {
    Session(AuthSession),
    PendingConfirmation {
        user_id: String,
        email: Option<String>,
    },
}

pub async fn sign_up(
    State(state): State<AppState>,
    Json(body): Json<SignUpRequest>,
) -> Result<Json<SignUpResponse>, AppError> {
    let input = SignUpInput {
        email: body.email,
        password: body.password,
        username: body.username,
        full_name: body.full_name,
    };
    let outcome = service::sign_up(&auth_context(&state), input)
        .await
        .map_err(auth_error)?;
    match outcome {
        SignUpOutcome::Session(session) => {
            tracing::info!(
                event = "auth.sign_up",
                user_id = %session.user.id,
                "user signed up"
            );
            Ok(Json(SignUpResponse::Session(session)))
        }
        SignUpOutcome::PendingConfirmation { user_id, email } => {
            tracing::info!(
                event = "auth.sign_up",
                user_id = %user_id,
                pending_confirmation = true,
                "user signed up pending email confirmation"
            );
            Ok(Json(SignUpResponse::PendingConfirmation {
                user_id: user_id.to_string(),
                email: Some(email),
            }))
        }
    }
}

#[derive(Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

pub async fn refresh(
    State(state): State<AppState>,
    Json(body): Json<RefreshRequest>,
) -> Result<Json<AuthSession>, AppError> {
    let session = service::refresh(&auth_context(&state), &body.refresh_token)
        .await
        .map_err(auth_error)?;
    tracing::info!(
        event = "auth.refresh",
        user_id = %session.user.id,
        "session refreshed"
    );
    Ok(Json(session))
}

#[derive(Deserialize)]
pub struct SignOutRequest {
    pub refresh_token: String,
}

pub async fn sign_out(
    State(state): State<AppState>,
    Json(body): Json<SignOutRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    service::sign_out(&state.pool, &body.refresh_token)
        .await
        .map_err(auth_error)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

#[derive(Deserialize)]
pub struct OAuthExchangeRequest {
    pub auth_code: String,
    pub code_verifier: String,
    pub redirect_uri: String,
}

pub async fn oauth_exchange(
    State(state): State<AppState>,
    Json(body): Json<OAuthExchangeRequest>,
) -> Result<Json<AuthSession>, AppError> {
    let session = service::oauth_google(
        &auth_context(&state),
        state.auth.google.as_ref(),
        &state.http,
        &body.auth_code,
        &body.code_verifier,
        &body.redirect_uri,
    )
    .await
    .map_err(auth_error)?;
    tracing::info!(
        event = "auth.oauth_exchange",
        user_id = %session.user.id,
        "oauth session created"
    );
    Ok(Json(session))
}

#[derive(Deserialize)]
pub struct ConfirmEmailRequest {
    pub token: String,
}

pub async fn confirm_email(
    State(state): State<AppState>,
    Json(body): Json<ConfirmEmailRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    service::confirm_email(&auth_context(&state), &body.token)
        .await
        .map_err(auth_error)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

#[derive(Deserialize)]
pub struct ForgotPasswordRequest {
    pub email: String,
}

pub async fn forgot_password(
    State(state): State<AppState>,
    Json(body): Json<ForgotPasswordRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    service::forgot_password(&auth_context(&state), &body.email)
        .await
        .map_err(auth_error)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

#[derive(Deserialize)]
pub struct ResetPasswordRequest {
    pub token: String,
    pub password: String,
}

pub async fn reset_password(
    State(state): State<AppState>,
    Json(body): Json<ResetPasswordRequest>,
) -> Result<Json<AuthSession>, AppError> {
    let session = service::reset_password(&auth_context(&state), &body.token, &body.password)
        .await
        .map_err(auth_error)?;
    tracing::info!(
        event = "auth.password_reset",
        user_id = %session.user.id,
        "password reset; new session issued"
    );
    Ok(Json(session))
}

/// Maps auth flow errors to the stable error codes the frontend expects.
fn auth_error(err: AuthFlowError) -> AppError {
    match err {
        AuthFlowError::InvalidCredentials => AppError::Unauthorized("invalid_credentials".into()),
        AuthFlowError::EmailNotConfirmed => AppError::Unauthorized("email_not_confirmed".into()),
        AuthFlowError::PasswordResetRequired => {
            AppError::Unauthorized("password_reset_required".into())
        }
        AuthFlowError::EmailAlreadyRegistered => {
            AppError::Conflict("email_already_registered".into())
        }
        AuthFlowError::InvalidEmail => AppError::BadRequest("invalid_email".into()),
        AuthFlowError::PasswordTooShort => AppError::BadRequest("password_too_short".into()),
        AuthFlowError::InvalidToken => AppError::Unauthorized("invalid_token".into()),
        AuthFlowError::OAuthNotConfigured => {
            tracing::warn!(
                event = "auth.oauth_not_configured",
                "google oauth requested but GOOGLE_CLIENT_ID/SECRET are not set"
            );
            AppError::BadRequest("oauth_not_configured".into())
        }
        AuthFlowError::OAuthFailed(reason) => {
            tracing::warn!(
                event = "auth.oauth_failed",
                reason = %reason,
                "google oauth exchange failed"
            );
            AppError::Unauthorized("oauth_exchange_failed".into())
        }
        AuthFlowError::Db(e) => AppError::from_db(e),
        AuthFlowError::Internal(reason) => {
            tracing::error!(
                event = "auth.internal_error",
                reason = %reason,
                "auth flow internal error"
            );
            AppError::Upstream("service_unavailable".into())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::auth_error;
    use crate::domain::auth::AuthFlowError;
    use crate::error::AppError;

    #[test]
    fn maps_invalid_credentials_to_code() {
        assert!(matches!(
            auth_error(AuthFlowError::InvalidCredentials),
            AppError::Unauthorized(ref code) if code == "invalid_credentials"
        ));
    }

    #[test]
    fn maps_email_already_registered_to_conflict_code() {
        assert!(matches!(
            auth_error(AuthFlowError::EmailAlreadyRegistered),
            AppError::Conflict(ref code) if code == "email_already_registered"
        ));
    }

    #[test]
    fn maps_password_too_short_to_bad_request() {
        assert!(matches!(
            auth_error(AuthFlowError::PasswordTooShort),
            AppError::BadRequest(ref code) if code == "password_too_short"
        ));
    }

    #[test]
    fn maps_email_not_confirmed_to_unauthorized() {
        assert!(matches!(
            auth_error(AuthFlowError::EmailNotConfirmed),
            AppError::Unauthorized(ref code) if code == "email_not_confirmed"
        ));
    }

    #[test]
    fn maps_password_reset_required_to_unauthorized() {
        assert!(matches!(
            auth_error(AuthFlowError::PasswordResetRequired),
            AppError::Unauthorized(ref code) if code == "password_reset_required"
        ));
    }

    #[test]
    fn maps_oauth_failure_to_stable_code() {
        assert!(matches!(
            auth_error(AuthFlowError::OAuthFailed("boom".into())),
            AppError::Unauthorized(ref code) if code == "oauth_exchange_failed"
        ));
    }

    #[test]
    fn maps_internal_error_to_sanitized_upstream() {
        assert!(matches!(
            auth_error(AuthFlowError::Internal("secret detail".into())),
            AppError::Upstream(ref code) if code == "service_unavailable"
        ));
    }
}
