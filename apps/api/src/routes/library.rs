use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use uuid::Uuid;

use crate::auth::{AuthUser, OptionalAuth};
use crate::domain::limits::MAX_SEARCH_QUERY_LEN;
use crate::domain::library::{
    self, present::build_library_story_items, CreateCollectionInput, LibraryCollection,
    LibraryCollectionSaveStatus, LibraryCollectionSummary, LibraryStatus, LibraryStoryItem,
    ReorderCollectionStoriesInput, UpdateCollectionInput,
};
use crate::domain::library::visibility::resolved_visibility;
use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: String,
}

pub async fn liked_stories(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Vec<LibraryStoryItem>>, AppError> {
    let rows = library::list_liked_stories(&state.pool, user.user_id)
        .await
        .map_err(AppError::from_db)?;
    let stories: Vec<_> = rows.iter().map(|r| r.story.clone()).collect();
    let liked_at: Vec<_> = rows.iter().map(|r| Some(r.liked_at)).collect();
    let library_added_at = vec![None; rows.len()];
    let universe_titles: Vec<_> = rows.iter().map(|r| r.universe_title.clone()).collect();
    let items = build_library_story_items(
        &state.pool,
        stories,
        library_added_at,
        liked_at,
        universe_titles,
    )
    .await
    .map_err(AppError::from_db)?;
    Ok(Json(items))
}

pub async fn list_collections(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Vec<LibraryCollectionSummary>>, AppError> {
    let collections = library::list_for_shelf(&state.pool, user.user_id)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(collections))
}

pub async fn get_collection(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<LibraryCollectionSummary>, AppError> {
    let collection = library::find_summary_for_viewer(&state.pool, id, user.user_id)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => AppError::NotFound,
            other => AppError::from_db(other),
        })?;
    Ok(Json(collection))
}

pub async fn search_collections(
    State(state): State<AppState>,
    auth: OptionalAuth,
    Query(query): Query<SearchQuery>,
) -> Result<Json<Vec<LibraryCollectionSummary>>, AppError> {
    let q = query.q.trim();
    if q.is_empty() {
        return Ok(Json(vec![]));
    }
    if q.len() > MAX_SEARCH_QUERY_LEN {
        return Err(AppError::BadRequest(format!(
            "search query must be at most {MAX_SEARCH_QUERY_LEN} characters"
        )));
    }
    let viewer_id = auth.user.as_ref().map(|u| u.user_id);
    let collections = library::search_public(&state.pool, q, viewer_id, 20)
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
    let visibility = resolved_visibility(body.visibility.as_deref())?;
    let collection = library::insert(&state.pool, user.user_id, &body, visibility)
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
) -> Result<Json<Vec<LibraryStoryItem>>, AppError> {
    let rows = library::list_stories_in_collection(&state.pool, id, user.user_id)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => AppError::NotFound,
            other => AppError::from_db(other),
        })?;
    let stories: Vec<_> = rows.iter().map(|r| r.story.clone()).collect();
    let library_added_at: Vec<_> = rows.iter().map(|r| Some(r.library_added_at)).collect();
    let liked_at = vec![None; rows.len()];
    let universe_titles: Vec<_> = rows.iter().map(|r| r.universe_title.clone()).collect();
    let items = build_library_story_items(
        &state.pool,
        stories,
        library_added_at,
        liked_at,
        universe_titles,
    )
    .await
    .map_err(AppError::from_db)?;
    Ok(Json(items))
}

pub async fn save_collection(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    library::save_collection(&state.pool, id, user.user_id)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => AppError::NotFound,
            other => AppError::from_db(other),
        })?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn unsave_collection(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    library::unsave_collection(&state.pool, id, user.user_id)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => AppError::NotFound,
            other => AppError::from_db(other),
        })?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn collection_save_status(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<LibraryCollectionSaveStatus>, AppError> {
    let saved = library::is_saved(&state.pool, id, user.user_id)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(LibraryCollectionSaveStatus { saved }))
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
