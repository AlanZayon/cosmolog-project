use serde::Serialize;
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Chapter {
    pub id: Uuid,
    pub story_id: Uuid,
    pub title: String,
    pub content: String,
    pub chapter_number: i32,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}
