use serde::{Deserialize, Serialize};
use serde_json::Value;
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct LoreEntry {
    pub id: Uuid,
    pub universe_id: Uuid,
    pub kind: String,
    pub slug: String,
    pub title: String,
    pub summary: Option<String>,
    pub cover_image_url: Option<String>,
    pub canon_status: String,
    pub publish_state: String,
    pub parent_entry_id: Option<Uuid>,
    pub sort_key: i32,
    pub custom_fields: Value,
    pub deleted_at: Option<OffsetDateTime>,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct LoreBlock {
    pub id: Uuid,
    pub entry_id: Uuid,
    pub block_type: String,
    pub content: String,
    pub block_order: i32,
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Deserialize)]
pub struct LoreBlockInput {
    pub block_type: String,
    pub content: String,
    pub block_order: i32,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct LoreRelation {
    pub id: Uuid,
    pub universe_id: Uuid,
    pub from_entry_id: Uuid,
    pub to_entry_id: Uuid,
    pub rel_type: String,
    pub label: Option<String>,
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct TimelineEvent {
    pub id: Uuid,
    pub universe_id: Uuid,
    pub title: String,
    pub summary: Option<String>,
    pub body: String,
    pub occurred_at_label: Option<String>,
    pub sort_key: i64,
    pub era_entry_id: Option<Uuid>,
    pub confidence: String,
    pub cover_image_url: Option<String>,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct LoreAppearance {
    pub id: Uuid,
    pub entry_id: Uuid,
    pub story_id: Option<Uuid>,
    pub chapter_id: Option<Uuid>,
    pub timeline_event_id: Option<Uuid>,
    pub note: Option<String>,
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct ArcLoreLink {
    pub arc_id: Uuid,
    pub entry_id: Uuid,
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct MapRow {
    pub id: Uuid,
    pub universe_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub image_url: String,
    pub sort_key: i32,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct MapPin {
    pub id: Uuid,
    pub map_id: Uuid,
    pub label: String,
    pub x_norm: f64,
    pub y_norm: f64,
    pub entry_id: Option<Uuid>,
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Deserialize)]
pub struct MapPinInput {
    pub label: String,
    pub x_norm: f64,
    pub y_norm: f64,
    pub entry_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct GalleryCollection {
    pub id: Uuid,
    pub universe_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub sort_key: i32,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct GalleryAsset {
    pub id: Uuid,
    pub collection_id: Uuid,
    pub image_url: String,
    pub caption: Option<String>,
    pub art_kind: String,
    pub entry_id: Option<Uuid>,
    pub sort_key: i32,
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Deserialize)]
pub struct GalleryAssetInput {
    pub image_url: String,
    pub caption: Option<String>,
    pub art_kind: String,
    pub entry_id: Option<Uuid>,
    pub sort_key: i32,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct CodexTocItem {
    pub id: Uuid,
    pub universe_id: Uuid,
    pub title: String,
    pub section_key: Option<String>,
    pub entry_id: Option<Uuid>,
    pub href_kind: Option<String>,
    pub sort_key: i32,
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CodexTocItemInput {
    pub title: String,
    pub section_key: Option<String>,
    pub entry_id: Option<Uuid>,
    pub href_kind: Option<String>,
    pub sort_key: i32,
}
