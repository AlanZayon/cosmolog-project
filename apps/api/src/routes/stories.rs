use axum::extract::{Path, Query, State};
use axum::Json;
use feed_contracts::events::{EventEnvelope, EventType, StoryCreatedPayload};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::domain::limits::MAX_SEARCH_QUERY_LEN;
use crate::domain::notifications;
use crate::domain::outbox;
use crate::domain::stories::{
    self, attach_profiles, validate_scope, CreateStoryInput, Story, StoryWithProfile,
};
use crate::domain::url_validation;
use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: String,
}

#[derive(Debug, Deserialize)]
pub struct UniverseStoriesQuery {
    pub r#type: Option<String>,
}

/// Creates a story for the authenticated user (metadata only; chapters/comic/blocks via follow-up).
pub async fn create(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<CreateStoryInput>,
) -> Result<Json<Story>, AppError> {
    body.validate()?;
    url_validation::validate_optional_stored_image_url(
        body.cover_image_url.as_deref(),
        &state.storage_settings.allowed_image_prefixes,
    )?;
    validate_scope(&state.pool, user.user_id, body.universe_id, body.arc_id).await?;

    let mut tx = state.pool.begin().await.map_err(AppError::from_db)?;
    let story = stories::insert(&mut *tx, user.user_id, &body)
        .await
        .map_err(AppError::from_db)?;

    let envelope = EventEnvelope::new(
        EventType::StoryCreated,
        json!(StoryCreatedPayload {
            story_id: story.id,
            author_id: user.user_id,
            universe_id: story.universe_id,
            arc_id: story.arc_id,
            story_type: story.r#type.clone(),
            tags: story.tags.clone(),
            created_at: story.created_at,
        }),
    );
    outbox::enqueue(&mut *tx, &envelope)
        .await
        .map_err(AppError::from_db)?;
    tx.commit().await.map_err(AppError::from_db)?;

    notifications::fanout_new_story(&state.pool, &state.notification_events, &story)
        .await
        .map_err(AppError::from_db)?;
    tracing::info!(
        event = "story.created",
        story_id = %story.id,
        author_id = %user.user_id,
        story_type = %story.r#type,
        "story created"
    );
    Ok(Json(story))
}

/// Lists stories authored by the authenticated user.
pub async fn list_mine(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Vec<Story>>, AppError> {
    let stories = stories::list_by_author_id(&state.pool, user.user_id)
        .await
        .map_err(AppError::from_db)?;

    Ok(Json(stories))
}

/// Search stories by title (public).
pub async fn search(
    State(state): State<AppState>,
    Query(query): Query<SearchQuery>,
) -> Result<Json<Vec<StoryWithProfile>>, AppError> {
    let q = query.q.trim();
    if q.is_empty() {
        return Ok(Json(vec![]));
    }
    if q.len() > MAX_SEARCH_QUERY_LEN {
        return Err(AppError::BadRequest(format!(
            "search query must be at most {MAX_SEARCH_QUERY_LEN} characters"
        )));
    }

    let stories = stories::search_by_title(&state.pool, q, 50)
        .await
        .map_err(AppError::from_db)?;
    let with_profiles = attach_profiles(&state.pool, stories)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(with_profiles))
}

/// Returns a single story by id (public read).
pub async fn by_id(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Story>, AppError> {
    let story = stories::find_by_id(&state.pool, id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;

    Ok(Json(story))
}

