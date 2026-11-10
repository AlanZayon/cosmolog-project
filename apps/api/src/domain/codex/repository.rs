use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::universes::{self, Universe};
use crate::error::AppError;

use super::model::{
    ArcLoreLink, CodexTocItem, CodexTocItemInput, GalleryAsset, GalleryAssetInput,
    GalleryCollection, LoreAppearance, LoreBlock, LoreBlockInput, LoreEntry, LoreRelation, MapPin,
    MapPinInput, MapRow, TimelineEvent,
};

const LORE_ENTRY_COLUMNS: &str = r#"id, universe_id, kind, slug, title, summary, cover_image_url,
    canon_status, publish_state, parent_entry_id, sort_key, custom_fields, deleted_at,
    created_at, updated_at"#;

pub async fn require_universe_owner(
    pool: &PgPool,
    universe_id: Uuid,
    user_id: Uuid,
) -> Result<Universe, AppError> {
    let universe = universes::find_by_id(pool, universe_id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;
    if universe.owner_id != user_id {
        return Err(AppError::unauthorized());
    }
    Ok(universe)
}

pub async fn find_entry_by_id(pool: &PgPool, id: Uuid) -> Result<Option<LoreEntry>, sqlx::Error> {
    sqlx::query_as::<_, LoreEntry>(&format!(
        r#"SELECT {LORE_ENTRY_COLUMNS} FROM lore_entries WHERE id = $1 AND deleted_at IS NULL"#
    ))
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn find_entry_by_slug(
    pool: &PgPool,
    universe_id: Uuid,
    slug: &str,
) -> Result<Option<LoreEntry>, sqlx::Error> {
    sqlx::query_as::<_, LoreEntry>(&format!(
        r#"
        SELECT {LORE_ENTRY_COLUMNS}
        FROM lore_entries
        WHERE universe_id = $1 AND slug = $2 AND deleted_at IS NULL
        "#
    ))
    .bind(universe_id)
    .bind(slug)
    .fetch_optional(pool)
    .await
}

pub async fn list_entries(
    pool: &PgPool,
    universe_id: Uuid,
    kind: Option<&str>,
    query: Option<&str>,
    include_drafts: bool,
) -> Result<Vec<LoreEntry>, sqlx::Error> {
    let pattern = query.map(|q| format!("%{}%", q.trim()));
    sqlx::query_as::<_, LoreEntry>(&format!(
        r#"
        SELECT {LORE_ENTRY_COLUMNS}
        FROM lore_entries
        WHERE universe_id = $1
          AND deleted_at IS NULL
          AND ($2::text IS NULL OR kind = $2)
          AND ($3::text IS NULL OR title ILIKE $3 OR summary ILIKE $3)
          AND ($4::bool OR publish_state = 'published')
        ORDER BY sort_key ASC, title ASC
        "#
    ))
    .bind(universe_id)
    .bind(kind)
    .bind(pattern)
    .bind(include_drafts)
    .fetch_all(pool)
    .await
}

#[allow(clippy::too_many_arguments)]
pub async fn insert_entry(
    pool: &PgPool,
    universe_id: Uuid,
    kind: &str,
    slug: &str,
    title: &str,
    summary: Option<&str>,
    cover_image_url: Option<&str>,
    canon_status: &str,
    publish_state: &str,
    parent_entry_id: Option<Uuid>,
    sort_key: i32,
    custom_fields: &Value,
) -> Result<LoreEntry, sqlx::Error> {
    sqlx::query_as::<_, LoreEntry>(&format!(
        r#"
        INSERT INTO lore_entries (
            universe_id, kind, slug, title, summary, cover_image_url,
            canon_status, publish_state, parent_entry_id, sort_key, custom_fields
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING {LORE_ENTRY_COLUMNS}
        "#
    ))
    .bind(universe_id)
    .bind(kind)
    .bind(slug)
    .bind(title)
    .bind(summary)
    .bind(cover_image_url)
    .bind(canon_status)
    .bind(publish_state)
    .bind(parent_entry_id)
    .bind(sort_key)
    .bind(custom_fields)
    .fetch_one(pool)
    .await
}

#[allow(clippy::too_many_arguments)]
pub async fn update_entry(
    pool: &PgPool,
    id: Uuid,
    kind: &str,
    slug: &str,
    title: &str,
    summary: Option<&str>,
    cover_image_url: Option<&str>,
    canon_status: &str,
    publish_state: &str,
    parent_entry_id: Option<Uuid>,
    sort_key: i32,
    custom_fields: &Value,
) -> Result<LoreEntry, sqlx::Error> {
    sqlx::query_as::<_, LoreEntry>(&format!(
        r#"
        UPDATE lore_entries SET
            kind = $2,
            slug = $3,
            title = $4,
            summary = $5,
            cover_image_url = $6,
            canon_status = $7,
            publish_state = $8,
            parent_entry_id = $9,
            sort_key = $10,
            custom_fields = $11,
            updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING {LORE_ENTRY_COLUMNS}
        "#
    ))
    .bind(id)
    .bind(kind)
    .bind(slug)
    .bind(title)
    .bind(summary)
    .bind(cover_image_url)
    .bind(canon_status)
    .bind(publish_state)
    .bind(parent_entry_id)
    .bind(sort_key)
    .bind(custom_fields)
    .fetch_one(pool)
    .await
}

pub async fn soft_delete_entry(pool: &PgPool, id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE lore_entries SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn list_blocks(pool: &PgPool, entry_id: Uuid) -> Result<Vec<LoreBlock>, sqlx::Error> {
    sqlx::query_as::<_, LoreBlock>(
        r#"
        SELECT id, entry_id, block_type, content, block_order, created_at
        FROM lore_blocks
        WHERE entry_id = $1
        ORDER BY block_order ASC
        "#,
    )
    .bind(entry_id)
    .fetch_all(pool)
    .await
}

pub async fn replace_blocks(
    pool: &PgPool,
    entry_id: Uuid,
    blocks: &[LoreBlockInput],
) -> Result<Vec<LoreBlock>, sqlx::Error> {
    let mut tx = pool.begin().await?;
    sqlx::query("DELETE FROM lore_blocks WHERE entry_id = $1")
        .bind(entry_id)
        .execute(&mut *tx)
        .await?;

    let mut out = Vec::new();
    for block in blocks {
        let row = sqlx::query_as::<_, LoreBlock>(
            r#"
            INSERT INTO lore_blocks (entry_id, block_type, content, block_order)
            VALUES ($1, $2, $3, $4)
            RETURNING id, entry_id, block_type, content, block_order, created_at
            "#,
        )
        .bind(entry_id)
        .bind(&block.block_type)
        .bind(&block.content)
        .bind(block.block_order)
        .fetch_one(&mut *tx)
        .await?;
        out.push(row);
    }
    tx.commit().await?;
    Ok(out)
}

pub async fn list_relations(
    pool: &PgPool,
    universe_id: Uuid,
    include_drafts: bool,
) -> Result<Vec<LoreRelation>, sqlx::Error> {
    sqlx::query_as::<_, LoreRelation>(
        r#"
        SELECT r.id, r.universe_id, r.from_entry_id, r.to_entry_id, r.rel_type, r.label, r.created_at
        FROM lore_relations r
        JOIN lore_entries src ON src.id = r.from_entry_id AND src.deleted_at IS NULL
        JOIN lore_entries dst ON dst.id = r.to_entry_id AND dst.deleted_at IS NULL
        WHERE r.universe_id = $1
          AND (
            $2::bool
            OR (src.publish_state = 'published' AND dst.publish_state = 'published')
          )
        ORDER BY r.created_at ASC
        "#,
    )
    .bind(universe_id)
    .bind(include_drafts)
    .fetch_all(pool)
    .await
}

pub async fn insert_relation(
    pool: &PgPool,
    universe_id: Uuid,
    from_entry_id: Uuid,
    to_entry_id: Uuid,
    rel_type: &str,
    label: Option<&str>,
) -> Result<LoreRelation, sqlx::Error> {
    sqlx::query_as::<_, LoreRelation>(
        r#"
        INSERT INTO lore_relations (universe_id, from_entry_id, to_entry_id, rel_type, label)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, universe_id, from_entry_id, to_entry_id, rel_type, label, created_at
        "#,
    )
    .bind(universe_id)
    .bind(from_entry_id)
    .bind(to_entry_id)
    .bind(rel_type)
    .bind(label)
    .fetch_one(pool)
    .await
}

pub async fn delete_relation(pool: &PgPool, id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM lore_relations WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn find_relation_by_id(
    pool: &PgPool,
    id: Uuid,
) -> Result<Option<LoreRelation>, sqlx::Error> {
    sqlx::query_as::<_, LoreRelation>(
        r#"
        SELECT id, universe_id, from_entry_id, to_entry_id, rel_type, label, created_at
        FROM lore_relations WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn list_timeline(
    pool: &PgPool,
    universe_id: Uuid,
) -> Result<Vec<TimelineEvent>, sqlx::Error> {
    sqlx::query_as::<_, TimelineEvent>(
        r#"
        SELECT id, universe_id, title, summary, body, occurred_at_label, sort_key,
               era_entry_id, confidence, cover_image_url, created_at, updated_at
        FROM timeline_events
        WHERE universe_id = $1
        ORDER BY sort_key ASC, created_at ASC
        "#,
    )
    .bind(universe_id)
    .fetch_all(pool)
    .await
}

pub async fn find_timeline_event(
    pool: &PgPool,
    id: Uuid,
) -> Result<Option<TimelineEvent>, sqlx::Error> {
    sqlx::query_as::<_, TimelineEvent>(
        r#"
        SELECT id, universe_id, title, summary, body, occurred_at_label, sort_key,
               era_entry_id, confidence, cover_image_url, created_at, updated_at
        FROM timeline_events WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

#[allow(clippy::too_many_arguments)]
pub async fn insert_timeline_event(
    pool: &PgPool,
    universe_id: Uuid,
    title: &str,
    summary: Option<&str>,
    body: &str,
    occurred_at_label: Option<&str>,
    sort_key: i64,
    era_entry_id: Option<Uuid>,
    confidence: &str,
    cover_image_url: Option<&str>,
) -> Result<TimelineEvent, sqlx::Error> {
    sqlx::query_as::<_, TimelineEvent>(
        r#"
        INSERT INTO timeline_events (
            universe_id, title, summary, body, occurred_at_label, sort_key,
            era_entry_id, confidence, cover_image_url
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, universe_id, title, summary, body, occurred_at_label, sort_key,
                  era_entry_id, confidence, cover_image_url, created_at, updated_at
        "#,
    )
    .bind(universe_id)
    .bind(title)
    .bind(summary)
    .bind(body)
    .bind(occurred_at_label)
    .bind(sort_key)
    .bind(era_entry_id)
    .bind(confidence)
    .bind(cover_image_url)
    .fetch_one(pool)
    .await
}

#[allow(clippy::too_many_arguments)]
pub async fn update_timeline_event(
    pool: &PgPool,
    id: Uuid,
    title: &str,
    summary: Option<&str>,
    body: &str,
    occurred_at_label: Option<&str>,
    sort_key: i64,
    era_entry_id: Option<Uuid>,
    confidence: &str,
    cover_image_url: Option<&str>,
) -> Result<TimelineEvent, sqlx::Error> {
    sqlx::query_as::<_, TimelineEvent>(
        r#"
        UPDATE timeline_events SET
            title = $2,
            summary = $3,
            body = $4,
            occurred_at_label = $5,
            sort_key = $6,
            era_entry_id = $7,
            confidence = $8,
            cover_image_url = $9,
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, universe_id, title, summary, body, occurred_at_label, sort_key,
                  era_entry_id, confidence, cover_image_url, created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(title)
    .bind(summary)
    .bind(body)
    .bind(occurred_at_label)
    .bind(sort_key)
    .bind(era_entry_id)
    .bind(confidence)
    .bind(cover_image_url)
    .fetch_one(pool)
    .await
}

pub async fn delete_timeline_event(pool: &PgPool, id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM timeline_events WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn list_appearances(
    pool: &PgPool,
    entry_id: Uuid,
) -> Result<Vec<LoreAppearance>, sqlx::Error> {
    sqlx::query_as::<_, LoreAppearance>(
        r#"
        SELECT id, entry_id, story_id, chapter_id, timeline_event_id, note, created_at
        FROM lore_appearances
        WHERE entry_id = $1
        ORDER BY created_at ASC
        "#,
    )
    .bind(entry_id)
    .fetch_all(pool)
    .await
}

pub async fn insert_appearance(
    pool: &PgPool,
    entry_id: Uuid,
    story_id: Option<Uuid>,
    chapter_id: Option<Uuid>,
    timeline_event_id: Option<Uuid>,
    note: Option<&str>,
) -> Result<LoreAppearance, sqlx::Error> {
    sqlx::query_as::<_, LoreAppearance>(
        r#"
        INSERT INTO lore_appearances (entry_id, story_id, chapter_id, timeline_event_id, note)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, entry_id, story_id, chapter_id, timeline_event_id, note, created_at
        "#,
    )
    .bind(entry_id)
    .bind(story_id)
    .bind(chapter_id)
    .bind(timeline_event_id)
    .bind(note)
    .fetch_one(pool)
    .await
}

pub async fn find_appearance(
    pool: &PgPool,
    id: Uuid,
) -> Result<Option<LoreAppearance>, sqlx::Error> {
    sqlx::query_as::<_, LoreAppearance>(
        r#"
        SELECT id, entry_id, story_id, chapter_id, timeline_event_id, note, created_at
        FROM lore_appearances WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn delete_appearance(pool: &PgPool, id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM lore_appearances WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn list_arc_lore_links(
    pool: &PgPool,
    arc_id: Uuid,
) -> Result<Vec<ArcLoreLink>, sqlx::Error> {
    sqlx::query_as::<_, ArcLoreLink>(
        r#"
        SELECT arc_id, entry_id, created_at
        FROM arc_lore_links
        WHERE arc_id = $1
        ORDER BY created_at ASC
        "#,
    )
    .bind(arc_id)
    .fetch_all(pool)
    .await
}

pub async fn insert_arc_lore_link(
    pool: &PgPool,
    arc_id: Uuid,
    entry_id: Uuid,
) -> Result<ArcLoreLink, sqlx::Error> {
    sqlx::query_as::<_, ArcLoreLink>(
        r#"
        INSERT INTO arc_lore_links (arc_id, entry_id)
        VALUES ($1, $2)
        RETURNING arc_id, entry_id, created_at
        "#,
    )
    .bind(arc_id)
    .bind(entry_id)
    .fetch_one(pool)
    .await
}

pub async fn delete_arc_lore_link(
    pool: &PgPool,
    arc_id: Uuid,
    entry_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM arc_lore_links WHERE arc_id = $1 AND entry_id = $2")
        .bind(arc_id)
        .bind(entry_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn list_maps(pool: &PgPool, universe_id: Uuid) -> Result<Vec<MapRow>, sqlx::Error> {
    sqlx::query_as::<_, MapRow>(
        r#"
        SELECT id, universe_id, title, description, image_url, sort_key, created_at, updated_at
        FROM maps
        WHERE universe_id = $1
        ORDER BY sort_key ASC, created_at ASC
        "#,
    )
    .bind(universe_id)
    .fetch_all(pool)
    .await
}

pub async fn find_map(pool: &PgPool, id: Uuid) -> Result<Option<MapRow>, sqlx::Error> {
    sqlx::query_as::<_, MapRow>(
        r#"
        SELECT id, universe_id, title, description, image_url, sort_key, created_at, updated_at
        FROM maps WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn insert_map(
    pool: &PgPool,
    universe_id: Uuid,
    title: &str,
    description: Option<&str>,
    image_url: &str,
    sort_key: i32,
) -> Result<MapRow, sqlx::Error> {
    sqlx::query_as::<_, MapRow>(
        r#"
        INSERT INTO maps (universe_id, title, description, image_url, sort_key)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, universe_id, title, description, image_url, sort_key, created_at, updated_at
        "#,
    )
    .bind(universe_id)
    .bind(title)
    .bind(description)
    .bind(image_url)
    .bind(sort_key)
    .fetch_one(pool)
    .await
}

pub async fn update_map(
    pool: &PgPool,
    id: Uuid,
    title: &str,
    description: Option<&str>,
    image_url: &str,
    sort_key: i32,
) -> Result<MapRow, sqlx::Error> {
    sqlx::query_as::<_, MapRow>(
        r#"
        UPDATE maps SET
            title = $2,
            description = $3,
            image_url = $4,
            sort_key = $5,
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, universe_id, title, description, image_url, sort_key, created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(title)
    .bind(description)
    .bind(image_url)
    .bind(sort_key)
    .fetch_one(pool)
    .await
}

pub async fn delete_map(pool: &PgPool, id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM maps WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn list_map_pins(pool: &PgPool, map_id: Uuid) -> Result<Vec<MapPin>, sqlx::Error> {
    sqlx::query_as::<_, MapPin>(
        r#"
        SELECT id, map_id, label, x_norm, y_norm, entry_id, created_at
        FROM map_pins
        WHERE map_id = $1
        ORDER BY created_at ASC
        "#,
    )
    .bind(map_id)
    .fetch_all(pool)
    .await
}

pub async fn replace_map_pins(
    pool: &PgPool,
    map_id: Uuid,
    pins: &[MapPinInput],
) -> Result<Vec<MapPin>, sqlx::Error> {
    let mut tx = pool.begin().await?;
    sqlx::query("DELETE FROM map_pins WHERE map_id = $1")
        .bind(map_id)
        .execute(&mut *tx)
        .await?;

    let mut out = Vec::new();
    for pin in pins {
        let row = sqlx::query_as::<_, MapPin>(
            r#"
            INSERT INTO map_pins (map_id, label, x_norm, y_norm, entry_id)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, map_id, label, x_norm, y_norm, entry_id, created_at
            "#,
        )
        .bind(map_id)
        .bind(pin.label.trim())
        .bind(pin.x_norm)
        .bind(pin.y_norm)
        .bind(pin.entry_id)
        .fetch_one(&mut *tx)
        .await?;
        out.push(row);
    }
    tx.commit().await?;
    Ok(out)
}

pub async fn list_gallery_collections(
    pool: &PgPool,
    universe_id: Uuid,
) -> Result<Vec<GalleryCollection>, sqlx::Error> {
    sqlx::query_as::<_, GalleryCollection>(
        r#"
        SELECT id, universe_id, title, description, sort_key, created_at, updated_at
        FROM gallery_collections
        WHERE universe_id = $1
        ORDER BY sort_key ASC, created_at ASC
        "#,
    )
    .bind(universe_id)
    .fetch_all(pool)
    .await
}

pub async fn find_gallery_collection(
    pool: &PgPool,
    id: Uuid,
) -> Result<Option<GalleryCollection>, sqlx::Error> {
    sqlx::query_as::<_, GalleryCollection>(
        r#"
        SELECT id, universe_id, title, description, sort_key, created_at, updated_at
        FROM gallery_collections WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn insert_gallery_collection(
    pool: &PgPool,
    universe_id: Uuid,
    title: &str,
    description: Option<&str>,
    sort_key: i32,
) -> Result<GalleryCollection, sqlx::Error> {
    sqlx::query_as::<_, GalleryCollection>(
        r#"
        INSERT INTO gallery_collections (universe_id, title, description, sort_key)
        VALUES ($1, $2, $3, $4)
        RETURNING id, universe_id, title, description, sort_key, created_at, updated_at
        "#,
    )
    .bind(universe_id)
    .bind(title)
    .bind(description)
    .bind(sort_key)
    .fetch_one(pool)
    .await
}

pub async fn update_gallery_collection(
    pool: &PgPool,
    id: Uuid,
    title: &str,
    description: Option<&str>,
    sort_key: i32,
) -> Result<GalleryCollection, sqlx::Error> {
    sqlx::query_as::<_, GalleryCollection>(
        r#"
        UPDATE gallery_collections SET
            title = $2,
            description = $3,
            sort_key = $4,
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, universe_id, title, description, sort_key, created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(title)
    .bind(description)
    .bind(sort_key)
    .fetch_one(pool)
    .await
}

pub async fn delete_gallery_collection(pool: &PgPool, id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM gallery_collections WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn list_gallery_assets(
    pool: &PgPool,
    collection_id: Uuid,
) -> Result<Vec<GalleryAsset>, sqlx::Error> {
    sqlx::query_as::<_, GalleryAsset>(
        r#"
        SELECT id, collection_id, image_url, caption, art_kind, entry_id, sort_key, created_at
        FROM gallery_assets
        WHERE collection_id = $1
        ORDER BY sort_key ASC, created_at ASC
        "#,
    )
    .bind(collection_id)
    .fetch_all(pool)
    .await
}

pub async fn replace_gallery_assets(
    pool: &PgPool,
    collection_id: Uuid,
    assets: &[GalleryAssetInput],
) -> Result<Vec<GalleryAsset>, sqlx::Error> {
    let mut tx = pool.begin().await?;
    sqlx::query("DELETE FROM gallery_assets WHERE collection_id = $1")
        .bind(collection_id)
        .execute(&mut *tx)
        .await?;

    let mut out = Vec::new();
    for asset in assets {
        let row = sqlx::query_as::<_, GalleryAsset>(
            r#"
            INSERT INTO gallery_assets (collection_id, image_url, caption, art_kind, entry_id, sort_key)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, collection_id, image_url, caption, art_kind, entry_id, sort_key, created_at
            "#,
        )
        .bind(collection_id)
        .bind(&asset.image_url)
        .bind(asset.caption.as_deref())
        .bind(&asset.art_kind)
        .bind(asset.entry_id)
        .bind(asset.sort_key)
        .fetch_one(&mut *tx)
        .await?;
        out.push(row);
    }
    tx.commit().await?;
    Ok(out)
}

pub async fn list_toc_items(
    pool: &PgPool,
    universe_id: Uuid,
) -> Result<Vec<CodexTocItem>, sqlx::Error> {
    sqlx::query_as::<_, CodexTocItem>(
        r#"
        SELECT id, universe_id, title, section_key, entry_id, href_kind, sort_key, created_at
        FROM codex_toc_items
        WHERE universe_id = $1
        ORDER BY sort_key ASC, created_at ASC
        "#,
    )
    .bind(universe_id)
    .fetch_all(pool)
    .await
}

pub async fn replace_toc_items(
    pool: &PgPool,
    universe_id: Uuid,
    items: &[CodexTocItemInput],
) -> Result<Vec<CodexTocItem>, sqlx::Error> {
    let mut tx = pool.begin().await?;
    sqlx::query("DELETE FROM codex_toc_items WHERE universe_id = $1")
        .bind(universe_id)
        .execute(&mut *tx)
        .await?;

    let mut out = Vec::new();
    for item in items {
        let row = sqlx::query_as::<_, CodexTocItem>(
            r#"
            INSERT INTO codex_toc_items (universe_id, title, section_key, entry_id, href_kind, sort_key)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, universe_id, title, section_key, entry_id, href_kind, sort_key, created_at
            "#,
        )
        .bind(universe_id)
        .bind(item.title.trim())
        .bind(item.section_key.as_deref())
        .bind(item.entry_id)
        .bind(item.href_kind.as_deref())
        .bind(item.sort_key)
        .fetch_one(&mut *tx)
        .await?;
        out.push(row);
    }
    tx.commit().await?;
    Ok(out)
}

pub async fn build_export_markdown(
    pool: &PgPool,
    universe_id: Uuid,
) -> Result<String, sqlx::Error> {
    let universe = universes::find_by_id(pool, universe_id)
        .await?
        .ok_or(sqlx::Error::RowNotFound)?;

    let entries = list_entries(pool, universe_id, None, None, false).await?;
    let timeline = list_timeline(pool, universe_id).await?;

    let mut md = String::new();
    md.push_str(&format!("# {}\n\n", universe.title));
    if let Some(premise) = &universe.saga_premise {
        md.push_str("## Saga premise\n\n");
        md.push_str(premise);
        md.push_str("\n\n");
    }

    if !timeline.is_empty() {
        md.push_str("## Timeline\n\n");
        for event in timeline {
            let label = event.occurred_at_label.as_deref().unwrap_or("—");
            md.push_str(&format!("### {} ({label})\n\n", event.title));
            if let Some(summary) = &event.summary {
                md.push_str(summary);
                md.push_str("\n\n");
            }
            if !event.body.trim().is_empty() {
                md.push_str(&event.body);
                md.push_str("\n\n");
            }
        }
    }

    if !entries.is_empty() {
        md.push_str("## Lore entries\n\n");
        for entry in entries {
            md.push_str(&format!(
                "### {} ({kind})\n\n",
                entry.title,
                kind = entry.kind
            ));
            if let Some(summary) = &entry.summary {
                md.push_str(summary);
                md.push_str("\n\n");
            }
            let blocks = list_blocks(pool, entry.id).await?;
            for block in blocks {
                if block.block_type == "text" {
                    md.push_str(&block.content);
                    md.push_str("\n\n");
                }
            }
        }
    }

    if let Some(afterword) = &universe.afterword {
        md.push_str("## Afterword\n\n");
        md.push_str(afterword);
        md.push('\n');
    }

    Ok(md)
}
