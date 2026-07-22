use axum::extract::{Path, State};
use axum::Json;
use serde::Deserialize;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::domain::arcs::{self, Arc};
use crate::domain::stories::StoryWithProfile;
use crate::domain::stories::{attach_profiles, list_by_arc_id};
use crate::domain::universes;
use crate::domain::url_validation;
use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct UpsertArcInput {
    pub name: String,
    pub description: Option<String>,
    pub r#type: String,
    pub cover_image_url: Option<String>,
}

impl UpsertArcInput {
    fn validate(&self) -> Result<(), AppError> {
        if self.name.trim().is_empty() {
            return Err(AppError::BadRequest("name is required".into()));
        }
        Ok(())
    }
}

pub async fn by_id(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Arc>, AppError> {
    let arc = arcs::find_by_id(&state.pool, id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    Ok(Json(arc))
}

pub async fn stories(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<StoryWithProfile>>, AppError> {
    let rows = list_by_arc_id(&state.pool, id)
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
    Json(body): Json<UpsertArcInput>,
) -> Result<Json<Arc>, AppError> {
    body.validate()?;
    url_validation::validate_optional_stored_image_url(
        body.cover_image_url.as_deref(),
        &state.storage_settings.allowed_image_prefixes,
    )?;
    let arc = arcs::find_by_id(&state.pool, id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    let universe = universes::find_by_id(&state.pool, arc.universe_id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    if universe.owner_id != user.user_id {
        return Err(AppError::unauthorized());
    }
    let updated = arcs::update(
        &state.pool,
        id,
        body.name.trim(),
        body.description.as_deref(),
        &body.r#type,
        body.cover_image_url.as_deref(),
    )
    .await
    .map_err(AppError::from_db)?;
    Ok(Json(updated))
}

pub async fn delete(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<(), AppError> {
    let arc = arcs::find_by_id(&state.pool, id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    let universe = universes::find_by_id(&state.pool, arc.universe_id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    if universe.owner_id != user.user_id {
        return Err(AppError::unauthorized());
    }
    arcs::delete_by_id(&state.pool, id)
        .await
        .map_err(AppError::from_db)?;
    Ok(())
}

pub async fn create_for_universe(
    State(state): State<AppState>,
    user: AuthUser,
    Path(universe_id): Path<Uuid>,
    Json(body): Json<UpsertArcInput>,
) -> Result<Json<Arc>, AppError> {
    body.validate()?;
    url_validation::validate_optional_stored_image_url(
        body.cover_image_url.as_deref(),
        &state.storage_settings.allowed_image_prefixes,
    )?;
    let universe = universes::find_by_id(&state.pool, universe_id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    if universe.owner_id != user.user_id {
        return Err(AppError::unauthorized());
    }
    let arc = arcs::insert(
        &state.pool,
        universe_id,
        body.name.trim(),
        body.description.as_deref(),
        &body.r#type,
        body.cover_image_url.as_deref(),
    )
    .await
    .map_err(AppError::from_db)?;
    Ok(Json(arc))
}
