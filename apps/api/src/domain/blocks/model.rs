use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct IllustratedBlock {
    pub id: Uuid,
    pub story_id: Uuid,
    pub chapter_id: Option<Uuid>,
    pub block_type: String,
    pub content: String,
    pub block_order: i32,
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Deserialize)]
pub struct BlockInput {
    pub block_type: String,
    pub content: String,
}
