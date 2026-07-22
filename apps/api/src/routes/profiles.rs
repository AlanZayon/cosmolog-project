use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Deserialize;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::domain::limits::{MAX_PROFILE_BATCH_IDS, MAX_SEARCH_QUERY_LEN};
use crate::domain::profiles::{self, Profile, UpdateProfileInput};
use crate::domain::stories::{attach_profiles, list_by_author_id, StoryWithProfile};
use crate::domain::universes::{self, Universe};
use crate::domain::url_validation;
use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct BatchQuery {
    pub ids: String,
}

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: String,
}

/// Returns the authenticated user's profile row from `profiles`.
pub async fn me(State(state): State<AppState>, user: AuthUser) -> Result<Json<Profile>, AppError> {
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
    url_validation::validate_nullable_image_url_update(
        validated.avatar_url.as_ref(),
        &state.storage_settings.allowed_image_prefixes,
    )?;
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
    if ids.len() > MAX_PROFILE_BATCH_IDS {
        return Err(AppError::BadRequest(format!(
            "at most {MAX_PROFILE_BATCH_IDS} ids allowed"
        )));
    }
    let profiles = profiles::find_by_user_ids(&state.pool, &ids)
        .await
        .map_err(AppError::from_db)?;

    Ok(Json(profiles))
}

/// Search profiles by username prefix/substring (public).
pub async fn search(
    State(state): State<AppState>,
    Query(query): Query<SearchQuery>,
) -> Result<Json<Vec<Profile>>, AppError> {
    let q = query.q.trim();
    if q.is_empty() {
        return Ok(Json(vec![]));
    }
    if q.len() > MAX_SEARCH_QUERY_LEN {
        return Err(AppError::BadRequest(format!(
            "search query must be at most {MAX_SEARCH_QUERY_LEN} characters"
        )));
    }

    let profiles = profiles::search_by_username(&state.pool, q, 20)
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

/// Public stories by profile username.
pub async fn stories_by_username(
    State(state): State<AppState>,
    Path(username): Path<String>,
) -> Result<Json<Vec<StoryWithProfile>>, AppError> {
    let username = username.trim();
    if username.is_empty() {
        return Err(AppError::BadRequest("username is required".into()));
    }

    let profile = profiles::find_by_username(&state.pool, username)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;

    let rows = list_by_author_id(&state.pool, profile.user_id)
        .await
        .map_err(AppError::from_db)?;
    let with_profiles = attach_profiles(&state.pool, rows)
        .await
        .map_err(AppError::from_db)?;

    Ok(Json(with_profiles))
}

/// Public universes owned by profile username.
pub async fn universes_by_username(
    State(state): State<AppState>,
    Path(username): Path<String>,
) -> Result<Json<Vec<Universe>>, AppError> {
    let username = username.trim();
    if username.is_empty() {
        return Err(AppError::BadRequest("username is required".into()));
    }

    let profile = profiles::find_by_username(&state.pool, username)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;

    let rows = universes::list_by_owner_id(&state.pool, profile.user_id)
        .await
        .map_err(AppError::from_db)?;

    Ok(Json(rows))
}
