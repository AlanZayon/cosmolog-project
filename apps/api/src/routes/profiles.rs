use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Deserialize;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::domain::profiles::{self, Profile, UpdateProfileInput};
use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct BatchQuery {
    pub ids: String,
}

/// Returns the authenticated user's profile row from `profiles`.
pub async fn me(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Profile>, AppError> {
    let profile = profiles::find_by_user_id(&state.pool, user.user_id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;

    Ok(Json(profile))
}

/// Updates the authenticated user's profile.
pub async fn update_me(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<UpdateProfileInput>,
) -> Result<Json<Profile>, AppError> {
    let validated = body.validate()?;
    let profile = profiles::update_by_user_id(&state.pool, user.user_id, &validated)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;

    Ok(Json(profile))
}

/// Profile by auth user id (public read).
pub async fn by_user_id(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<Profile>, AppError> {
    let profile = profiles::find_by_user_id(&state.pool, user_id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;

    Ok(Json(profile))
}

/// Batch profiles by user ids (`?ids=uuid1,uuid2`).
pub async fn batch(
    State(state): State<AppState>,
    Query(query): Query<BatchQuery>,
) -> Result<Json<Vec<Profile>>, AppError> {
    let ids: Result<Vec<Uuid>, _> = query
        .ids
        .split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(Uuid::parse_str)
        .collect();

    let ids = ids.map_err(|_| AppError::BadRequest("invalid user id in ids".into()))?;
    let profiles = profiles::find_by_user_ids(&state.pool, &ids)
        .await
        .map_err(AppError::from_db)?;

    Ok(Json(profiles))
}

/// Public profile lookup by username.
pub async fn by_username(
    State(state): State<AppState>,
    Path(username): Path<String>,
) -> Result<Json<Profile>, AppError> {
    let username = username.trim();
    if username.is_empty() {
        return Err(AppError::BadRequest("username is required".into()));
    }

    let profile = profiles::find_by_username(&state.pool, username)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;

    Ok(Json(profile))
}
