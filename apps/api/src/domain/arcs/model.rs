use serde::Serialize;
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Arc {
    pub id: Uuid,
    pub universe_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub r#type: String,
    pub cover_image_url: Option<String>,
    pub created_at: OffsetDateTime,
}
