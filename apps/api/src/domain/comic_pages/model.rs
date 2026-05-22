use serde::Serialize;
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct ComicPage {
    pub id: Uuid,
    pub story_id: Uuid,
    pub image_url: String,
    pub page_order: i32,
    pub created_at: OffsetDateTime,
}
