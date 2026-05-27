use serde::Serialize;
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct CommentWithAuthor {
    pub id: Uuid,
    pub story_id: Uuid,
    pub user_id: Uuid,
    pub content: String,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    pub parent_id: Option<Uuid>,
    pub likes_count: i32,
    pub liked: bool,
    pub username: Option<String>,
}
