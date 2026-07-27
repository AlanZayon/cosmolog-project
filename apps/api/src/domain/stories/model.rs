use serde::Serialize;
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Story {
    pub id: Uuid,
    pub author_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub cover_image_url: Option<String>,
    pub feed_display_mode: String,
    pub reading_mode: String,
    pub content: Option<String>,
    pub r#type: String,
    pub universe_id: Option<Uuid>,
    pub arc_id: Option<Uuid>,
    pub tags: Option<Vec<String>>,
    pub likes_count: i32,
    pub comments_count: i32,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}
