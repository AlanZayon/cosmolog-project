use axum::extract::{Path, Query, State};
use axum::Json;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::domain::arcs::{self, Arc};
use crate::domain::stories::{attach_profiles, list_by_universe_id, StoryWithProfile};
use crate::domain::follows;
use crate::domain::universes::{self, CreateUniverseInput, Universe, UpdateUniverseInput};
use serde::Serialize;
use crate::error::AppError;
use crate::routes::stories::UniverseStoriesQuery;
use crate::state::AppState;

/// Creates a universe for the authenticated user.
pub async fn create(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<CreateUniverseInput>,
) -> Result<Json<Universe>, AppError> {
    body.validate()?;
    let universe = universes::insert(&state.pool, user.user_id, &body)
        .await
        .map_err(AppError::from_db)?;
    tracing::info!(
        event = "universe.created",
        universe_id = %universe.id,
        owner_id = %user.user_id,
        "universe created"
    );
    Ok(Json(universe))
}

/// Lists universes owned by the authenticated user.
pub async fn list_mine(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Vec<Universe>>, AppError> {
    let universes = universes::list_by_owner_id(&state.pool, user.user_id)
        .await
        .map_err(AppError::from_db)?;

    Ok(Json(universes))
}

/// Returns a single universe by id (public read).
pub async fn by_id(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Universe>, AppError> {
    let universe = universes::find_by_id(&state.pool, id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;

    Ok(Json(universe))
}

/// Lists arcs in a universe (public read).
pub async fn arcs(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<Arc>>, AppError> {
    let rows = arcs::list_by_universe_id(&state.pool, id)
        .await
        .map_err(AppError::from_db)?;

    Ok(Json(rows))
}

/// Lists stories in a universe with author profiles (public read).
pub async fn stories(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<UniverseStoriesQuery>,
) -> Result<Json<Vec<StoryWithProfile>>, AppError> {
    let story_type = query.r#type.as_deref();
    let rows = list_by_universe_id(&state.pool, id, story_type)
        .await
        .map_err(AppError::from_db)?;
    let with_profiles = attach_profiles(&state.pool, rows)
        .await
        .map_err(AppError::from_db)?;

    Ok(Json(with_profiles))
}

pub async fn update(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateUniverseInput>,
) -> Result<Json<Universe>, AppError> {
    body.validate()?;
    let universe = universes::update(&state.pool, id, user.user_id, &body)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => AppError::NotFound,
            other => AppError::from_db(other),
        })?;
    Ok(Json(universe))
}

#[derive(Debug, Serialize)]
pub struct FollowingResponse {
    pub following: bool,
}

pub async fn follow_status(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<FollowingResponse>, AppError> {
    let following = follows::has_follow(&state.pool, id, user.user_id)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(FollowingResponse { following }))
}

pub async fn follow(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<(), AppError> {
    follows::insert_follow(&state.pool, id, user.user_id)
        .await
        .map_err(AppError::from_db)?;
    Ok(())
}

pub async fn unfollow(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<(), AppError> {
    follows::delete_follow(&state.pool, id, user.user_id)
        .await
        .map_err(AppError::from_db)?;
    Ok(())
}
