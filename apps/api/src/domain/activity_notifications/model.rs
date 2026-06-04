use serde::Serialize;
use time::OffsetDateTime;
use uuid::Uuid;

pub const KIND_COMMENT_MENTION: &str = "comment_mention";
pub const KIND_STORY_COMMENT: &str = "story_comment";
pub const KIND_COMMENT_REPLY: &str = "comment_reply";
pub const KIND_COMMENT_LIKED: &str = "comment_liked";
pub const KIND_PROFILE_ALERT_ACTIVATED: &str = "profile_alert_activated";
pub const KIND_UNIVERSE_ALERT_ACTIVATED: &str = "universe_alert_activated";
pub const KIND_COLLECTION_SAVED: &str = "collection_saved";

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct ActivityNotification {
    pub id: Uuid,
    pub recipient_id: Uuid,
    pub actor_id: Uuid,
    pub kind: String,
    pub story_id: Option<Uuid>,
    pub comment_id: Option<Uuid>,
    pub universe_id: Option<Uuid>,
    pub collection_id: Option<Uuid>,
    pub read_at: Option<OffsetDateTime>,
    pub clicked_at: Option<OffsetDateTime>,
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct ActivityNotificationListRow {
    pub id: Uuid,
    pub kind: String,
    pub read_at: Option<OffsetDateTime>,
    pub clicked_at: Option<OffsetDateTime>,
    pub created_at: OffsetDateTime,
    pub actor_id: Uuid,
    pub actor_username: String,
    pub actor_avatar_url: Option<String>,
    pub story_id: Option<Uuid>,
    pub story_title: Option<String>,
    pub comment_id: Option<Uuid>,
    pub universe_id: Option<Uuid>,
    pub universe_title: Option<String>,
    pub collection_id: Option<Uuid>,
    pub collection_name: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ActivityNotificationListItem {
    pub id: Uuid,
    pub kind: String,
    pub read_at: Option<OffsetDateTime>,
    pub clicked_at: Option<OffsetDateTime>,
    pub created_at: OffsetDateTime,
    pub actor_id: Uuid,
    pub actor_username: String,
    pub actor_avatar_url: Option<String>,
    pub story_id: Option<Uuid>,
    pub story_title: Option<String>,
    pub comment_id: Option<Uuid>,
    pub universe_id: Option<Uuid>,
    pub universe_title: Option<String>,
    pub collection_id: Option<Uuid>,
    pub collection_name: Option<String>,
}

impl From<ActivityNotificationListRow> for ActivityNotificationListItem {
    fn from(row: ActivityNotificationListRow) -> Self {
        Self {
            id: row.id,
            kind: row.kind,
            read_at: row.read_at,
            clicked_at: row.clicked_at,
            created_at: row.created_at,
            actor_id: row.actor_id,
            actor_username: row.actor_username,
            actor_avatar_url: row.actor_avatar_url,
            story_id: row.story_id,
            story_title: row.story_title,
            comment_id: row.comment_id,
            universe_id: row.universe_id,
            universe_title: row.universe_title,
            collection_id: row.collection_id,
            collection_name: row.collection_name,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ActivityNotificationListResponse {
    pub items: Vec<ActivityNotificationListItem>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ActivityUnreadCountResponse {
    pub count: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct MarkActivityNotificationReadResponse {
    pub id: Uuid,
    pub read_at: OffsetDateTime,
    pub clicked_at: OffsetDateTime,
}

#[derive(Debug, Clone, Serialize)]
pub struct MarkAllActivityNotificationsReadResponse {
    pub marked_count: i64,
}
