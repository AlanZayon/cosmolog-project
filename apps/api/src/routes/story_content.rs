use axum::extract::{Path, Query, State};
use axum::Json;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::{AuthUser, OptionalAuth};
use crate::domain::activity_notifications;
use crate::domain::blocks::{self, BlockInput, IllustratedBlock};
use crate::domain::chapters::{self, Chapter};
use crate::domain::comic_pages::{self, ComicPage};
use crate::domain::comment_likes;
use crate::domain::comments::{self, CommentWithAuthor};
use crate::domain::likes;
use crate::domain::limits::{MAX_BLOCK_CONTENT_LEN, MAX_BLOCK_COUNT, MAX_COMMENT_LEN};
use crate::domain::stories::{self, validate_scope, Story, UpdateStoryInput};
use crate::domain::url_validation;
use crate::error::AppError;
use crate::state::AppState;

async fn require_author(
    pool: &sqlx::PgPool,
    story_id: Uuid,
    user_id: Uuid,
) -> Result<Story, AppError> {
    let story = stories::find_by_id(pool, story_id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    if story.author_id != user_id {
        return Err(AppError::unauthorized());
    }
    Ok(story)
}

pub async fn update_story(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateStoryInput>,
) -> Result<Json<Story>, AppError> {
    body.validate()?;
    url_validation::validate_nullable_image_url_update(
        body.cover_image_url.as_ref(),
        &state.storage_settings.allowed_image_prefixes,
    )?;
    let existing = stories::find_by_id(&state.pool, id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    let _ = require_author(&state.pool, id, user.user_id).await?;

    let effective_universe_id = match &body.universe_id {
        None => existing.universe_id,
        Some(value) => *value,
    };
    let effective_arc_id = match &body.arc_id {
        None => existing.arc_id,
        Some(value) => *value,
    };
    validate_scope(
        &state.pool,
        user.user_id,
        effective_universe_id,
        effective_arc_id,
    )
    .await?;

    let story = stories::update(&state.pool, id, user.user_id, &body)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => AppError::NotFound,
            other => AppError::from_db(other),
        })?;
    Ok(Json(story))
}

#[derive(Debug, Deserialize)]
pub struct BlocksQuery {
    pub chapter_id: Option<Uuid>,
}

pub async fn list_blocks(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(q): Query<BlocksQuery>,
) -> Result<Json<Vec<IllustratedBlock>>, AppError> {
    let rows = blocks::list_for_story(&state.pool, id, q.chapter_id)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct ReplaceBlocksBody {
    pub blocks: Vec<BlockInput>,
}

pub async fn replace_blocks(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<BlocksQuery>,
    Json(body): Json<ReplaceBlocksBody>,
) -> Result<Json<Vec<IllustratedBlock>>, AppError> {
    let _ = require_author(&state.pool, id, user.user_id).await?;
    if body.blocks.len() > MAX_BLOCK_COUNT {
        return Err(AppError::BadRequest(format!(
            "at most {MAX_BLOCK_COUNT} blocks allowed"
        )));
    }
    for block in &body.blocks {
        if block.content.len() > MAX_BLOCK_CONTENT_LEN {
            return Err(AppError::BadRequest(format!(
                "block content must be at most {MAX_BLOCK_CONTENT_LEN} characters"
            )));
        }
        match block.block_type.as_str() {
            "text" => {}
            "image" => {
                url_validation::validate_stored_image_url(
                    block.content.trim(),
                    &state.storage_settings.allowed_image_prefixes,
                )?;
            }
            _ => {
                return Err(AppError::BadRequest("invalid block type".into()));
            }
        }
    }
    let rows = blocks::replace_for_story(&state.pool, id, q.chapter_id, &body.blocks)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(rows))
}

pub async fn list_chapters(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<Chapter>>, AppError> {
    let rows = chapters::list_by_story_id(&state.pool, id)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct ChapterNumberQuery {
    pub number: i32,
}

pub async fn chapter_by_number(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(q): Query<ChapterNumberQuery>,
) -> Result<Json<Chapter>, AppError> {
    let row = chapters::find_by_story_and_number(&state.pool, id, q.number)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct CreateChapterInput {
    pub title: String,
}

pub async fn create_chapter(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateChapterInput>,
) -> Result<Json<Chapter>, AppError> {
    let _ = require_author(&state.pool, id, user.user_id).await?;
    let title = body.title.trim();
    if title.is_empty() {
        return Err(AppError::BadRequest("title is required".into()));
    }
    let count = chapters::count_by_story_id(&state.pool, id)
        .await
        .map_err(AppError::from_db)?;
    let row = chapters::insert(&state.pool, id, title, (count + 1) as i32)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct UpdateChapterInput {
    pub title: String,
}

pub async fn update_chapter(
    State(state): State<AppState>,
    user: AuthUser,
    Path((story_id, chapter_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateChapterInput>,
) -> Result<Json<Chapter>, AppError> {
    let _ = require_author(&state.pool, story_id, user.user_id).await?;
    let chapter = chapters::find_by_id(&state.pool, chapter_id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    if chapter.story_id != story_id {
        return Err(AppError::NotFound);
    }
    let title = body.title.trim();
    if title.is_empty() {
        return Err(AppError::BadRequest("title is required".into()));
    }
    let row = chapters::update_title(&state.pool, chapter_id, title)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(row))
}

pub async fn list_comic_pages(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<ComicPage>>, AppError> {
    let rows = comic_pages::list_by_story_id(&state.pool, id)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct ComicPageInput {
    pub image_url: String,
    pub page_order: i32,
}

#[derive(Debug, Deserialize)]
pub struct ReplaceComicPagesBody {
    pub pages: Vec<ComicPageInput>,
}

pub async fn replace_comic_pages(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<ReplaceComicPagesBody>,
) -> Result<Json<Vec<ComicPage>>, AppError> {
    let _ = require_author(&state.pool, id, user.user_id).await?;
    let allowed_prefixes = &state.storage_settings.allowed_image_prefixes;
    let pages: Vec<(String, i32)> = body
        .pages
        .into_iter()
        .map(|p| {
            url_validation::validate_stored_image_url(&p.image_url, allowed_prefixes)?;
            Ok((p.image_url, p.page_order))
        })
        .collect::<Result<Vec<_>, AppError>>()?;
    let rows = comic_pages::replace_for_story(&state.pool, id, &pages)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(rows))
}

pub async fn insert_comic_page(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<ComicPageInput>,
) -> Result<Json<Vec<ComicPage>>, AppError> {
    let _ = require_author(&state.pool, id, user.user_id).await?;
    url_validation::validate_stored_image_url(
        &body.image_url,
        &state.storage_settings.allowed_image_prefixes,
    )?;
    let existing = comic_pages::list_by_story_id(&state.pool, id)
        .await
        .map_err(AppError::from_db)?;
    let mut pages: Vec<(String, i32)> = existing
        .into_iter()
        .map(|p| (p.image_url, p.page_order))
        .collect();
    pages.push((body.image_url, body.page_order));
    let rows = comic_pages::replace_for_story(&state.pool, id, &pages)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(rows))
}

pub async fn list_comments(
    State(state): State<AppState>,
    OptionalAuth { user, .. }: OptionalAuth,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<CommentWithAuthor>>, AppError> {
    let viewer_id = user.as_ref().map(|u| u.user_id);
    let rows = comments::list_by_story_id(&state.pool, id, viewer_id)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreateCommentInput {
    pub content: String,
    pub parent_id: Option<Uuid>,
}

pub async fn create_comment(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateCommentInput>,
) -> Result<Json<CommentWithAuthor>, AppError> {
    let content = body.content.trim();
    if content.is_empty() {
        return Err(AppError::BadRequest("content is required".into()));
    }
    if content.len() > MAX_COMMENT_LEN {
        return Err(AppError::BadRequest(format!(
            "comment must be at most {MAX_COMMENT_LEN} characters"
        )));
    }

    let reply_to_comment_id = body.parent_id;

    let parent_id = if let Some(parent_id) = body.parent_id {
        let Some((story_id, _)) = comments::find_by_id(&state.pool, parent_id)
            .await
            .map_err(AppError::from_db)?
        else {
            return Err(AppError::NotFound);
        };
        if story_id != id {
            return Err(AppError::BadRequest(
                "parent comment does not belong to this story".into(),
            ));
        }
        comments::resolve_thread_root(&state.pool, parent_id)
            .await
            .map_err(AppError::from_db)?
            .or(Some(parent_id))
    } else {
        None
    };

    let row = comments::insert(&state.pool, id, user.user_id, content, parent_id)
        .await
        .map_err(AppError::from_db)?;

    activity_notifications::fanout_comment_activity(
        &state.pool,
        &state.activity_notification_events,
        user.user_id,
        id,
        row.id,
        content,
        reply_to_comment_id,
    )
    .await
    .map_err(AppError::from_db)?;

    Ok(Json(row))
}

pub async fn comment_like_status(
    State(state): State<AppState>,
    user: AuthUser,
    Path((_story_id, comment_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<LikedResponse>, AppError> {
    let liked = comment_likes::has_like(&state.pool, comment_id, user.user_id)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(LikedResponse { liked }))
}

pub async fn toggle_comment_like(
    State(state): State<AppState>,
    user: AuthUser,
    Path((story_id, comment_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<LikedResponse>, AppError> {
    let Some((comment_story_id, _)) = comments::find_by_id(&state.pool, comment_id)
        .await
        .map_err(AppError::from_db)?
    else {
        return Err(AppError::NotFound);
    };
    if comment_story_id != story_id {
        return Err(AppError::NotFound);
    }

    let liked = comment_likes::has_like(&state.pool, comment_id, user.user_id)
        .await
        .map_err(AppError::from_db)?;
    if liked {
        comment_likes::delete_like(&state.pool, comment_id, user.user_id)
            .await
            .map_err(AppError::from_db)?;
        Ok(Json(LikedResponse { liked: false }))
    } else {
        let newly_liked = comment_likes::insert_like(&state.pool, comment_id, user.user_id)
            .await
            .map_err(AppError::from_db)?;

        if newly_liked {
            if let Some((author_id, comment_story_id)) =
                comments::find_author_and_story(&state.pool, comment_id)
                    .await
                    .map_err(AppError::from_db)?
            {
                let delivered = activity_notifications::insert_comment_liked(
                    &state.pool,
                    author_id,
                    user.user_id,
                    comment_story_id,
                    comment_id,
                )
                .await
                .map_err(AppError::from_db)?;
                activity_notifications::deliver_optional(
                    &state.pool,
                    &state.activity_notification_events,
                    delivered,
                )
                .await;
            }
        }

        Ok(Json(LikedResponse { liked: true }))
    }
}

#[derive(Debug, Serialize)]
pub struct LikedResponse {
    pub liked: bool,
}

pub async fn like_status(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<LikedResponse>, AppError> {
    let liked = likes::has_like(&state.pool, id, user.user_id)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(LikedResponse { liked }))
}

pub async fn toggle_like(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<LikedResponse>, AppError> {
    let liked = likes::has_like(&state.pool, id, user.user_id)
        .await
        .map_err(AppError::from_db)?;
    if liked {
        likes::delete_like(&state.pool, id, user.user_id)
            .await
            .map_err(AppError::from_db)?;
        Ok(Json(LikedResponse { liked: false }))
    } else {
        likes::insert_like(&state.pool, id, user.user_id)
            .await
            .map_err(AppError::from_db)?;
        Ok(Json(LikedResponse { liked: true }))
    }
}

pub async fn chapter_count(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let count = chapters::count_by_story_id(&state.pool, id)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(serde_json::json!({ "count": count })))
}
