use serde::Serialize;
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Universe {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub cover_image_url: Option<String>,
    pub owner_id: Uuid,
    pub codex_enabled: bool,
    pub saga_premise: Option<String>,
    pub default_calendar_label: Option<String>,
    pub afterword: Option<String>,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}
