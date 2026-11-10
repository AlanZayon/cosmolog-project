use axum::extract::{Path, Query, State};
use axum::http::{header, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::auth::{AuthUser, OptionalAuth};
use crate::domain::codex::{
    self, kinds, ArcLoreLink, CodexTocItem, CodexTocItemInput, GalleryAsset, GalleryAssetInput,
    GalleryCollection, LoreAppearance, LoreBlock, LoreBlockInput, LoreEntry, LoreRelation, MapPin,
    MapPinInput, MapRow, TimelineEvent,
};
use crate::domain::universes;
use crate::domain::url_validation;
use crate::domain::{arcs, chapters, stories};
use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct ListEntriesQuery {
    pub kind: Option<String>,
    pub q: Option<String>,
    pub include_drafts: Option<bool>,
}

async fn universe_owner_id(pool: &sqlx::PgPool, universe_id: Uuid) -> Result<Uuid, AppError> {
    let universe = universes::find_by_id(pool, universe_id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    Ok(universe.owner_id)
}

fn entry_visible(entry: &LoreEntry, viewer_id: Option<Uuid>, owner_id: Uuid) -> bool {
    entry.publish_state == "published" || viewer_id == Some(owner_id)
}

async fn ensure_entry_in_universe(
    pool: &sqlx::PgPool,
    entry_id: Uuid,
    universe_id: Uuid,
) -> Result<(), AppError> {
    let entry = codex::find_entry_by_id(pool, entry_id)
        .await
        .map_err(AppError::from_db)?
        .ok_or_else(|| AppError::BadRequest("entry not found in universe".into()))?;
    if entry.universe_id != universe_id {
        return Err(AppError::BadRequest("entry not in universe".into()));
    }
    Ok(())
}

async fn ensure_appearance_target(
    pool: &sqlx::PgPool,
    universe_id: Uuid,
    body: &CreateAppearanceBody,
) -> Result<(), AppError> {
    if let Some(story_id) = body.story_id {
        let story = stories::find_by_id(pool, story_id)
            .await
            .map_err(AppError::from_db)?
            .ok_or_else(|| AppError::BadRequest("story not found".into()))?;
        if story.universe_id != Some(universe_id) {
            return Err(AppError::BadRequest("story not in universe".into()));
        }
    }
    if let Some(chapter_id) = body.chapter_id {
        let chapter = chapters::find_by_id(pool, chapter_id)
            .await
            .map_err(AppError::from_db)?
            .ok_or_else(|| AppError::BadRequest("chapter not found".into()))?;
        let story = stories::find_by_id(pool, chapter.story_id)
            .await
            .map_err(AppError::from_db)?
            .ok_or_else(|| AppError::BadRequest("story not found".into()))?;
        if story.universe_id != Some(universe_id) {
            return Err(AppError::BadRequest("chapter not in universe".into()));
        }
    }
    if let Some(event_id) = body.timeline_event_id {
        let event = codex::find_timeline_event(pool, event_id)
            .await
            .map_err(AppError::from_db)?
            .ok_or_else(|| AppError::BadRequest("timeline event not found".into()))?;
        if event.universe_id != universe_id {
            return Err(AppError::BadRequest(
                "timeline event not in universe".into(),
            ));
        }
    }
    Ok(())
}

async fn load_visible_entry(
    pool: &sqlx::PgPool,
    entry_id: Uuid,
    viewer_id: Option<Uuid>,
) -> Result<LoreEntry, AppError> {
    let entry = codex::find_entry_by_id(pool, entry_id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    let owner_id = universe_owner_id(pool, entry.universe_id).await?;
    if !entry_visible(&entry, viewer_id, owner_id) {
        return Err(AppError::NotFound);
    }
    Ok(entry)
}

#[derive(Debug, Deserialize)]
pub struct CreateEntryBody {
    pub kind: String,
    pub slug: String,
    pub title: String,
    pub summary: Option<String>,
    pub cover_image_url: Option<String>,
    pub canon_status: Option<String>,
    pub publish_state: Option<String>,
    pub parent_entry_id: Option<Uuid>,
    pub sort_key: Option<i32>,
    pub custom_fields: Option<Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateEntryBody {
    pub kind: Option<String>,
    pub slug: Option<String>,
    pub title: Option<String>,
    pub summary: Option<Option<String>>,
    pub cover_image_url: Option<Option<String>>,
    pub canon_status: Option<String>,
    pub publish_state: Option<String>,
    pub parent_entry_id: Option<Option<Uuid>>,
    pub sort_key: Option<i32>,
    pub custom_fields: Option<Value>,
}

fn validate_entry_fields(
    kind: &str,
    slug: &str,
    title: &str,
    canon_status: &str,
    publish_state: &str,
    cover_image_url: Option<&str>,
    allowed_prefixes: &[String],
) -> Result<(String, String, String), AppError> {
    kinds::validate_lore_kind(kind)?;
    kinds::validate_canon_status(canon_status)?;
    kinds::validate_publish_state(publish_state)?;
    let slug = kinds::normalize_slug(slug)?;
    let title = title.trim();
    if title.is_empty() {
        return Err(AppError::BadRequest("title is required".into()));
    }
    url_validation::validate_optional_stored_image_url(cover_image_url, allowed_prefixes)?;
    Ok((slug, title.to_string(), kind.to_string()))
}

pub async fn list_entries(
    State(state): State<AppState>,
    OptionalAuth { user, .. }: OptionalAuth,
    Path(universe_id): Path<Uuid>,
    Query(query): Query<ListEntriesQuery>,
) -> Result<Json<Vec<LoreEntry>>, AppError> {
    let _ = universes::find_by_id(&state.pool, universe_id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;

    let owner_id = universe_owner_id(&state.pool, universe_id).await?;
    let viewer = user.as_ref().map(|u| u.user_id);
    let want_drafts = query.include_drafts.unwrap_or(false);
    let include_drafts = want_drafts && viewer == Some(owner_id);

    let rows = codex::list_entries(
        &state.pool,
        universe_id,
        query.kind.as_deref(),
        query.q.as_deref(),
        include_drafts,
    )
    .await
    .map_err(AppError::from_db)?;
    Ok(Json(rows))
}

pub async fn create_entry(
    State(state): State<AppState>,
    user: AuthUser,
    Path(universe_id): Path<Uuid>,
    Json(body): Json<CreateEntryBody>,
) -> Result<Json<LoreEntry>, AppError> {
    codex::require_universe_owner(&state.pool, universe_id, user.user_id).await?;
    let canon_status = body.canon_status.as_deref().unwrap_or("canon");
    let publish_state = body.publish_state.as_deref().unwrap_or("published");
    let (slug, title, kind) = validate_entry_fields(
        &body.kind,
        &body.slug,
        &body.title,
        canon_status,
        publish_state,
        body.cover_image_url.as_deref(),
        &state.storage_settings.allowed_image_prefixes,
    )?;
    let custom_fields = body.custom_fields.unwrap_or_else(|| json!({}));
    let row = codex::insert_entry(
        &state.pool,
        universe_id,
        &kind,
        &slug,
        &title,
        body.summary.as_deref(),
        body.cover_image_url.as_deref(),
        canon_status,
        publish_state,
        body.parent_entry_id,
        body.sort_key.unwrap_or(0),
        &custom_fields,
    )
    .await
    .map_err(AppError::from_db)?;
    Ok(Json(row))
}

pub async fn get_entry(
    State(state): State<AppState>,
    OptionalAuth { user, .. }: OptionalAuth,
    Path(id): Path<Uuid>,
) -> Result<Json<LoreEntry>, AppError> {
    let viewer = user.as_ref().map(|u| u.user_id);
    let entry = load_visible_entry(&state.pool, id, viewer).await?;
    Ok(Json(entry))
}

pub async fn get_entry_by_slug(
    State(state): State<AppState>,
    OptionalAuth { user, .. }: OptionalAuth,
    Path((universe_id, slug)): Path<(Uuid, String)>,
) -> Result<Json<LoreEntry>, AppError> {
    let slug = kinds::normalize_slug(&slug)?;
    let entry = codex::find_entry_by_slug(&state.pool, universe_id, &slug)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    let owner_id = universe_owner_id(&state.pool, universe_id).await?;
    let viewer = user.as_ref().map(|u| u.user_id);
    if !entry_visible(&entry, viewer, owner_id) {
        return Err(AppError::NotFound);
    }
    Ok(Json(entry))
}

pub async fn patch_entry(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateEntryBody>,
) -> Result<Json<LoreEntry>, AppError> {
    let existing = codex::find_entry_by_id(&state.pool, id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    codex::require_universe_owner(&state.pool, existing.universe_id, user.user_id).await?;

    let kind = body.kind.as_deref().unwrap_or(&existing.kind);
    let slug = body.slug.as_deref().unwrap_or(&existing.slug);
    let title = body.title.as_deref().unwrap_or(&existing.title);
    let canon_status = body
        .canon_status
        .as_deref()
        .unwrap_or(&existing.canon_status);
    let publish_state = body
        .publish_state
        .as_deref()
        .unwrap_or(&existing.publish_state);
    let summary = match &body.summary {
        Some(v) => v.as_deref(),
        None => existing.summary.as_deref(),
    };
    let cover_image_url = match &body.cover_image_url {
        Some(v) => v.as_deref(),
        None => existing.cover_image_url.as_deref(),
    };
    url_validation::validate_nullable_image_url_update(
        body.cover_image_url.as_ref(),
        &state.storage_settings.allowed_image_prefixes,
    )?;
    let parent_entry_id = match &body.parent_entry_id {
        Some(v) => *v,
        None => existing.parent_entry_id,
    };
    let sort_key = body.sort_key.unwrap_or(existing.sort_key);
    let custom_fields = body
        .custom_fields
        .as_ref()
        .unwrap_or(&existing.custom_fields);

    let (slug, title, kind) = validate_entry_fields(
        kind,
        slug,
        title,
        canon_status,
        publish_state,
        cover_image_url,
        &state.storage_settings.allowed_image_prefixes,
    )?;

    let updated = codex::update_entry(
        &state.pool,
        id,
        &kind,
        &slug,
        &title,
        summary,
        cover_image_url,
        canon_status,
        publish_state,
        parent_entry_id,
        sort_key,
        custom_fields,
    )
    .await
    .map_err(AppError::from_db)?;
    Ok(Json(updated))
}

pub async fn delete_entry(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<(), AppError> {
    let existing = codex::find_entry_by_id(&state.pool, id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    codex::require_universe_owner(&state.pool, existing.universe_id, user.user_id).await?;
    codex::soft_delete_entry(&state.pool, id)
        .await
        .map_err(AppError::from_db)?;
    Ok(())
}

pub async fn list_blocks(
    State(state): State<AppState>,
    OptionalAuth { user, .. }: OptionalAuth,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<LoreBlock>>, AppError> {
    let viewer = user.as_ref().map(|u| u.user_id);
    let _ = load_visible_entry(&state.pool, id, viewer).await?;
    let rows = codex::list_blocks(&state.pool, id)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct ReplaceBlocksBody {
    pub blocks: Vec<LoreBlockInput>,
}

pub async fn replace_blocks(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<ReplaceBlocksBody>,
) -> Result<Json<Vec<LoreBlock>>, AppError> {
    let existing = codex::find_entry_by_id(&state.pool, id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    codex::require_universe_owner(&state.pool, existing.universe_id, user.user_id).await?;
    let prefixes = &state.storage_settings.allowed_image_prefixes;
    for block in &body.blocks {
        kinds::validate_block_type(&block.block_type)?;
        if block.block_type == "image" {
            url_validation::validate_stored_image_url(block.content.trim(), prefixes)?;
        }
    }
    let rows = codex::replace_blocks(&state.pool, id, &body.blocks)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(rows))
}

pub async fn list_relations(
    State(state): State<AppState>,
    OptionalAuth { user, .. }: OptionalAuth,
    Path(universe_id): Path<Uuid>,
) -> Result<Json<Vec<LoreRelation>>, AppError> {
    let owner_id = universe_owner_id(&state.pool, universe_id).await?;
    let viewer = user.as_ref().map(|u| u.user_id);
    let include_drafts = viewer == Some(owner_id);
    let rows = codex::list_relations(&state.pool, universe_id, include_drafts)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreateRelationBody {
    pub from_entry_id: Uuid,
    pub to_entry_id: Uuid,
    pub rel_type: String,
    pub label: Option<String>,
}

pub async fn create_relation(
    State(state): State<AppState>,
    user: AuthUser,
    Path(universe_id): Path<Uuid>,
    Json(body): Json<CreateRelationBody>,
) -> Result<Json<LoreRelation>, AppError> {
    codex::require_universe_owner(&state.pool, universe_id, user.user_id).await?;
    kinds::validate_rel_type(&body.rel_type)?;
    if body.from_entry_id == body.to_entry_id {
        return Err(AppError::BadRequest(
            "relation cannot connect entry to itself".into(),
        ));
    }
    for entry_id in [body.from_entry_id, body.to_entry_id] {
        let entry = codex::find_entry_by_id(&state.pool, entry_id)
            .await
            .map_err(AppError::from_db)?
            .ok_or(AppError::BadRequest("entry not found in universe".into()))?;
        if entry.universe_id != universe_id {
            return Err(AppError::BadRequest("entry not in universe".into()));
        }
    }
    let row = codex::insert_relation(
        &state.pool,
        universe_id,
        body.from_entry_id,
        body.to_entry_id,
        &body.rel_type,
        body.label.as_deref(),
    )
    .await
    .map_err(AppError::from_db)?;
    Ok(Json(row))
}

pub async fn delete_relation(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<(), AppError> {
    let rel = codex::find_relation_by_id(&state.pool, id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    codex::require_universe_owner(&state.pool, rel.universe_id, user.user_id).await?;
    codex::delete_relation(&state.pool, id)
        .await
        .map_err(AppError::from_db)?;
    Ok(())
}

pub async fn list_timeline(
    State(state): State<AppState>,
    Path(universe_id): Path<Uuid>,
) -> Result<Json<Vec<TimelineEvent>>, AppError> {
    let _ = universes::find_by_id(&state.pool, universe_id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    let rows = codex::list_timeline(&state.pool, universe_id)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct UpsertTimelineBody {
    pub title: String,
    pub summary: Option<String>,
    pub body: Option<String>,
    pub occurred_at_label: Option<String>,
    pub sort_key: Option<i64>,
    pub era_entry_id: Option<Uuid>,
    pub confidence: Option<String>,
    pub cover_image_url: Option<String>,
}

fn validate_timeline_body(
    body: &UpsertTimelineBody,
    allowed_prefixes: &[String],
) -> Result<(String, String, String, i64), AppError> {
    let title = body.title.trim();
    if title.is_empty() {
        return Err(AppError::BadRequest("title is required".into()));
    }
    let body_text = body.body.as_deref().unwrap_or("").to_string();
    let confidence = body
        .confidence
        .as_deref()
        .unwrap_or("confirmed")
        .to_string();
    kinds::validate_timeline_confidence(&confidence)?;
    url_validation::validate_optional_stored_image_url(
        body.cover_image_url.as_deref(),
        allowed_prefixes,
    )?;
    Ok((
        title.to_string(),
        body_text,
        confidence,
        body.sort_key.unwrap_or(0),
    ))
}

pub async fn create_timeline_event(
    State(state): State<AppState>,
    user: AuthUser,
    Path(universe_id): Path<Uuid>,
    Json(body): Json<UpsertTimelineBody>,
) -> Result<Json<TimelineEvent>, AppError> {
    codex::require_universe_owner(&state.pool, universe_id, user.user_id).await?;
    let (title, body_text, confidence, sort_key) =
        validate_timeline_body(&body, &state.storage_settings.allowed_image_prefixes)?;
    if let Some(era_id) = body.era_entry_id {
        ensure_entry_in_universe(&state.pool, era_id, universe_id).await?;
    }
    let row = codex::insert_timeline_event(
        &state.pool,
        universe_id,
        &title,
        body.summary.as_deref(),
        &body_text,
        body.occurred_at_label.as_deref(),
        sort_key,
        body.era_entry_id,
        &confidence,
        body.cover_image_url.as_deref(),
    )
    .await
    .map_err(AppError::from_db)?;
    Ok(Json(row))
}

pub async fn patch_timeline_event(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpsertTimelineBody>,
) -> Result<Json<TimelineEvent>, AppError> {
    let existing = codex::find_timeline_event(&state.pool, id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    codex::require_universe_owner(&state.pool, existing.universe_id, user.user_id).await?;
    let (title, body_text, confidence, sort_key) =
        validate_timeline_body(&body, &state.storage_settings.allowed_image_prefixes)?;
    if let Some(era_id) = body.era_entry_id {
        ensure_entry_in_universe(&state.pool, era_id, existing.universe_id).await?;
    }
    let updated = codex::update_timeline_event(
        &state.pool,
        id,
        &title,
        body.summary.as_deref(),
        &body_text,
        body.occurred_at_label.as_deref(),
        sort_key,
        body.era_entry_id,
        &confidence,
        body.cover_image_url.as_deref(),
    )
    .await
    .map_err(AppError::from_db)?;
    Ok(Json(updated))
}

pub async fn get_timeline_event(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<TimelineEvent>, AppError> {
    let event = codex::find_timeline_event(&state.pool, id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    Ok(Json(event))
}

pub async fn delete_timeline_event(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<(), AppError> {
    let existing = codex::find_timeline_event(&state.pool, id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    codex::require_universe_owner(&state.pool, existing.universe_id, user.user_id).await?;
    codex::delete_timeline_event(&state.pool, id)
        .await
        .map_err(AppError::from_db)?;
    Ok(())
}

pub async fn list_appearances(
    State(state): State<AppState>,
    OptionalAuth { user, .. }: OptionalAuth,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<LoreAppearance>>, AppError> {
    let viewer = user.as_ref().map(|u| u.user_id);
    let _ = load_visible_entry(&state.pool, id, viewer).await?;
    let rows = codex::list_appearances(&state.pool, id)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreateAppearanceBody {
    pub story_id: Option<Uuid>,
    pub chapter_id: Option<Uuid>,
    pub timeline_event_id: Option<Uuid>,
    pub note: Option<String>,
}

pub async fn create_appearance(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateAppearanceBody>,
) -> Result<Json<LoreAppearance>, AppError> {
    let entry = codex::find_entry_by_id(&state.pool, id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    codex::require_universe_owner(&state.pool, entry.universe_id, user.user_id).await?;
    let targets = [
        body.story_id.is_some(),
        body.chapter_id.is_some(),
        body.timeline_event_id.is_some(),
    ];
    if targets.iter().filter(|&&x| x).count() != 1 {
        return Err(AppError::BadRequest(
            "exactly one of story_id, chapter_id, timeline_event_id is required".into(),
        ));
    }
    ensure_appearance_target(&state.pool, entry.universe_id, &body).await?;
    let row = codex::insert_appearance(
        &state.pool,
        id,
        body.story_id,
        body.chapter_id,
        body.timeline_event_id,
        body.note.as_deref(),
    )
    .await
    .map_err(AppError::from_db)?;
    Ok(Json(row))
}

pub async fn delete_appearance(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<(), AppError> {
    let appearance = codex::find_appearance(&state.pool, id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    let entry = codex::find_entry_by_id(&state.pool, appearance.entry_id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    codex::require_universe_owner(&state.pool, entry.universe_id, user.user_id).await?;
    codex::delete_appearance(&state.pool, id)
        .await
        .map_err(AppError::from_db)?;
    Ok(())
}

pub async fn list_arc_lore_links(
    State(state): State<AppState>,
    Path(arc_id): Path<Uuid>,
) -> Result<Json<Vec<ArcLoreLink>>, AppError> {
    let _ = arcs::find_by_id(&state.pool, arc_id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    let rows = codex::list_arc_lore_links(&state.pool, arc_id)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct ArcLoreLinkBody {
    pub entry_id: Uuid,
}

pub async fn create_arc_lore_link(
    State(state): State<AppState>,
    user: AuthUser,
    Path(arc_id): Path<Uuid>,
    Json(body): Json<ArcLoreLinkBody>,
) -> Result<Json<ArcLoreLink>, AppError> {
    let arc = arcs::find_by_id(&state.pool, arc_id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    codex::require_universe_owner(&state.pool, arc.universe_id, user.user_id).await?;
    let entry = codex::find_entry_by_id(&state.pool, body.entry_id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    if entry.universe_id != arc.universe_id {
        return Err(AppError::BadRequest("entry not in arc universe".into()));
    }
    let row = codex::insert_arc_lore_link(&state.pool, arc_id, body.entry_id)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(row))
}

pub async fn delete_arc_lore_link(
    State(state): State<AppState>,
    user: AuthUser,
    Path((arc_id, entry_id)): Path<(Uuid, Uuid)>,
) -> Result<(), AppError> {
    let arc = arcs::find_by_id(&state.pool, arc_id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    codex::require_universe_owner(&state.pool, arc.universe_id, user.user_id).await?;
    codex::delete_arc_lore_link(&state.pool, arc_id, entry_id)
        .await
        .map_err(AppError::from_db)?;
    Ok(())
}

pub async fn list_maps(
    State(state): State<AppState>,
    Path(universe_id): Path<Uuid>,
) -> Result<Json<Vec<MapRow>>, AppError> {
    let _ = universes::find_by_id(&state.pool, universe_id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    let rows = codex::list_maps(&state.pool, universe_id)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct UpsertMapBody {
    pub title: String,
    pub description: Option<String>,
    pub image_url: String,
    pub sort_key: Option<i32>,
}

fn validate_map_body(
    body: &UpsertMapBody,
    allowed_prefixes: &[String],
) -> Result<String, AppError> {
    let title = body.title.trim();
    if title.is_empty() {
        return Err(AppError::BadRequest("title is required".into()));
    }
    url_validation::validate_stored_image_url(&body.image_url, allowed_prefixes)?;
    Ok(title.to_string())
}

pub async fn create_map(
    State(state): State<AppState>,
    user: AuthUser,
    Path(universe_id): Path<Uuid>,
    Json(body): Json<UpsertMapBody>,
) -> Result<Json<MapRow>, AppError> {
    codex::require_universe_owner(&state.pool, universe_id, user.user_id).await?;
    let title = validate_map_body(&body, &state.storage_settings.allowed_image_prefixes)?;
    let row = codex::insert_map(
        &state.pool,
        universe_id,
        &title,
        body.description.as_deref(),
        &body.image_url,
        body.sort_key.unwrap_or(0),
    )
    .await
    .map_err(AppError::from_db)?;
    Ok(Json(row))
}

pub async fn patch_map(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpsertMapBody>,
) -> Result<Json<MapRow>, AppError> {
    let existing = codex::find_map(&state.pool, id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    codex::require_universe_owner(&state.pool, existing.universe_id, user.user_id).await?;
    let title = validate_map_body(&body, &state.storage_settings.allowed_image_prefixes)?;
    let updated = codex::update_map(
        &state.pool,
        id,
        &title,
        body.description.as_deref(),
        &body.image_url,
        body.sort_key.unwrap_or(existing.sort_key),
    )
    .await
    .map_err(AppError::from_db)?;
    Ok(Json(updated))
}

pub async fn get_map(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<MapRow>, AppError> {
    let map = codex::find_map(&state.pool, id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    Ok(Json(map))
}

pub async fn delete_map(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<(), AppError> {
    let existing = codex::find_map(&state.pool, id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    codex::require_universe_owner(&state.pool, existing.universe_id, user.user_id).await?;
    codex::delete_map(&state.pool, id)
        .await
        .map_err(AppError::from_db)?;
    Ok(())
}

pub async fn list_map_pins(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<MapPin>>, AppError> {
    let _ = codex::find_map(&state.pool, id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    let rows = codex::list_map_pins(&state.pool, id)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct ReplaceMapPinsBody {
    pub pins: Vec<MapPinInput>,
}

pub async fn replace_map_pins(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<ReplaceMapPinsBody>,
) -> Result<Json<Vec<MapPin>>, AppError> {
    let existing = codex::find_map(&state.pool, id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    codex::require_universe_owner(&state.pool, existing.universe_id, user.user_id).await?;
    for pin in &body.pins {
        if pin.label.trim().is_empty() {
            return Err(AppError::BadRequest("pin label is required".into()));
        }
        if !(0.0..=1.0).contains(&pin.x_norm) || !(0.0..=1.0).contains(&pin.y_norm) {
            return Err(AppError::BadRequest(
                "pin coordinates must be between 0 and 1".into(),
            ));
        }
        if let Some(entry_id) = pin.entry_id {
            ensure_entry_in_universe(&state.pool, entry_id, existing.universe_id).await?;
        }
    }
    let rows = codex::replace_map_pins(&state.pool, id, &body.pins)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(rows))
}

pub async fn list_gallery_collections(
    State(state): State<AppState>,
    Path(universe_id): Path<Uuid>,
) -> Result<Json<Vec<GalleryCollection>>, AppError> {
    let _ = universes::find_by_id(&state.pool, universe_id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    let rows = codex::list_gallery_collections(&state.pool, universe_id)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct UpsertGalleryCollectionBody {
    pub title: String,
    pub description: Option<String>,
    pub sort_key: Option<i32>,
}

pub async fn create_gallery_collection(
    State(state): State<AppState>,
    user: AuthUser,
    Path(universe_id): Path<Uuid>,
    Json(body): Json<UpsertGalleryCollectionBody>,
) -> Result<Json<GalleryCollection>, AppError> {
    codex::require_universe_owner(&state.pool, universe_id, user.user_id).await?;
    let title = body.title.trim();
    if title.is_empty() {
        return Err(AppError::BadRequest("title is required".into()));
    }
    let row = codex::insert_gallery_collection(
        &state.pool,
        universe_id,
        title,
        body.description.as_deref(),
        body.sort_key.unwrap_or(0),
    )
    .await
    .map_err(AppError::from_db)?;
    Ok(Json(row))
}

pub async fn patch_gallery_collection(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpsertGalleryCollectionBody>,
) -> Result<Json<GalleryCollection>, AppError> {
    let existing = codex::find_gallery_collection(&state.pool, id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    codex::require_universe_owner(&state.pool, existing.universe_id, user.user_id).await?;
    let title = body.title.trim();
    if title.is_empty() {
        return Err(AppError::BadRequest("title is required".into()));
    }
    let updated = codex::update_gallery_collection(
        &state.pool,
        id,
        title,
        body.description.as_deref(),
        body.sort_key.unwrap_or(existing.sort_key),
    )
    .await
    .map_err(AppError::from_db)?;
    Ok(Json(updated))
}

pub async fn get_gallery_collection(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<GalleryCollection>, AppError> {
    let collection = codex::find_gallery_collection(&state.pool, id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    Ok(Json(collection))
}

pub async fn delete_gallery_collection(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<(), AppError> {
    let existing = codex::find_gallery_collection(&state.pool, id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    codex::require_universe_owner(&state.pool, existing.universe_id, user.user_id).await?;
    codex::delete_gallery_collection(&state.pool, id)
        .await
        .map_err(AppError::from_db)?;
    Ok(())
}

pub async fn list_gallery_assets(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<GalleryAsset>>, AppError> {
    let _ = codex::find_gallery_collection(&state.pool, id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    let rows = codex::list_gallery_assets(&state.pool, id)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct ReplaceGalleryAssetsBody {
    pub assets: Vec<GalleryAssetInput>,
}

pub async fn replace_gallery_assets(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<ReplaceGalleryAssetsBody>,
) -> Result<Json<Vec<GalleryAsset>>, AppError> {
    let existing = codex::find_gallery_collection(&state.pool, id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    codex::require_universe_owner(&state.pool, existing.universe_id, user.user_id).await?;
    let prefixes = &state.storage_settings.allowed_image_prefixes;
    for asset in &body.assets {
        kinds::validate_art_kind(&asset.art_kind)?;
        url_validation::validate_stored_image_url(&asset.image_url, prefixes)?;
        if let Some(entry_id) = asset.entry_id {
            ensure_entry_in_universe(&state.pool, entry_id, existing.universe_id).await?;
        }
    }
    let rows = codex::replace_gallery_assets(&state.pool, id, &body.assets)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(rows))
}

pub async fn list_toc(
    State(state): State<AppState>,
    Path(universe_id): Path<Uuid>,
) -> Result<Json<Vec<CodexTocItem>>, AppError> {
    let _ = universes::find_by_id(&state.pool, universe_id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    let rows = codex::list_toc_items(&state.pool, universe_id)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct ReplaceTocBody {
    pub items: Vec<CodexTocItemInput>,
}

pub async fn replace_toc(
    State(state): State<AppState>,
    user: AuthUser,
    Path(universe_id): Path<Uuid>,
    Json(body): Json<ReplaceTocBody>,
) -> Result<Json<Vec<CodexTocItem>>, AppError> {
    codex::require_universe_owner(&state.pool, universe_id, user.user_id).await?;
    for item in &body.items {
        if item.title.trim().is_empty() {
            return Err(AppError::BadRequest("toc title is required".into()));
        }
        if let Some(href) = &item.href_kind {
            kinds::validate_toc_href_kind(href)?;
        }
        if let Some(entry_id) = item.entry_id {
            ensure_entry_in_universe(&state.pool, entry_id, universe_id).await?;
        }
    }
    let rows = codex::replace_toc_items(&state.pool, universe_id, &body.items)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(rows))
}

pub async fn export_markdown(
    State(state): State<AppState>,
    Path(universe_id): Path<Uuid>,
) -> Result<Response, AppError> {
    let _ = universes::find_by_id(&state.pool, universe_id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    let md = codex::build_export_markdown(&state.pool, universe_id)
        .await
        .map_err(AppError::from_db)?;
    Ok((
        StatusCode::OK,
        [(header::CONTENT_TYPE, "text/markdown; charset=utf-8")],
        md,
    )
        .into_response())
}
