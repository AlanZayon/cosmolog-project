use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::domain::library::{
    self, CreateCollectionInput, LibraryCollection, LibraryCollectionSummary, LibraryStatus,
    ReorderCollectionStoriesInput, UpdateCollectionInput,
};
use crate::domain::stories::{attach_profiles, StoryWithProfile};
use crate::error::AppError;
use crate::state::AppState;

pub async fn liked_stories(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Vec<StoryWithProfile>>, AppError> {
    let stories = library::list_liked_stories(&state.pool, user.user_id)
        .await
        .map_err(AppError::from_db)?;
    let with_profiles = attach_profiles(&state.pool, stories)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(with_profiles))
}

pub async fn list_collections(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Vec<LibraryCollectionSummary>>, AppError> {
    let collections = library::list_by_user_id(&state.pool, user.user_id)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(collections))
}

pub async fn create_collection(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<CreateCollectionInput>,
) -> Result<Json<LibraryCollection>, AppError> {
    body.validate()?;
    let collection = library::insert(&state.pool, user.user_id, &body)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(collection))
}

pub async fn update_collection(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateCollectionInput>,
) -> Result<Json<LibraryCollection>, AppError> {
    body.validate()?;
    let collection = library::update(&state.pool, id, user.user_id, &body)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => AppError::NotFound,
            other => AppError::from_db(other),
        })?;
    Ok(Json(collection))
}

pub async fn delete_collection(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    library::delete(&state.pool, id, user.user_id)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => AppError::NotFound,
            other => AppError::from_db(other),
        })?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn list_collection_stories(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<StoryWithProfile>>, AppError> {
    let stories = library::list_stories_in_collection(&state.pool, id, user.user_id)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => AppError::NotFound,
            other => AppError::from_db(other),
        })?;
    let with_profiles = attach_profiles(&state.pool, stories)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(with_profiles))
}

pub async fn add_story(
    State(state): State<AppState>,
    user: AuthUser,
    Path((collection_id, story_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    library::insert_item(&state.pool, collection_id, story_id, user.user_id)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => AppError::NotFound,
            other => AppError::from_db(other),
        })?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn remove_story(
    State(state): State<AppState>,
    user: AuthUser,
    Path((collection_id, story_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    library::delete_item(&state.pool, collection_id, story_id, user.user_id)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => AppError::NotFound,
            other => AppError::from_db(other),
        })?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn reorder_collection_stories(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<ReorderCollectionStoriesInput>,
) -> Result<StatusCode, AppError> {
    body.validate()?;
    library::reorder_stories(&state.pool, id, user.user_id, &body)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => AppError::NotFound,
            other => AppError::from_db(other),
        })?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn library_status(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<LibraryStatus>, AppError> {
    let status = library::library_status(&state.pool, id, user.user_id)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(status))
}
