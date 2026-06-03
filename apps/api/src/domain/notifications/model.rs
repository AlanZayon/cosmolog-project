use serde::Serialize;
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct NotificationSubscription {
    pub id: Uuid,
    pub subscriber_id: Uuid,
    pub target_user_id: Uuid,
    pub scope: String,
    pub universe_id: Option<Uuid>,
    pub active: bool,
    pub unconsumed_count: i32,
    pub disabled_at: Option<OffsetDateTime>,
    pub disabled_reason: Option<String>,
    pub last_consumed_at: Option<OffsetDateTime>,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Clone, sqlx::FromRow)]
#[allow(dead_code)]
pub struct Notification {
    pub id: Uuid,
    pub recipient_id: Uuid,
    pub subscription_id: Uuid,
    pub story_id: Uuid,
    pub kind: String,
    pub read_at: Option<OffsetDateTime>,
    pub clicked_at: Option<OffsetDateTime>,
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Clone, Serialize)]
pub struct SubscriptionStatus {
    pub subscribed: bool,
    pub active: bool,
    pub scope: String,
    pub universe_id: Option<Uuid>,
    pub unconsumed_count: i32,
    pub disabled_reason: Option<String>,
    pub disabled_at: Option<OffsetDateTime>,
    pub last_consumed_at: Option<OffsetDateTime>,
}

impl SubscriptionStatus {
    pub fn not_subscribed(scope: &str) -> Self {
        Self {
            subscribed: false,
            active: false,
            scope: scope.to_string(),
            universe_id: None,
            unconsumed_count: 0,
            disabled_reason: None,
            disabled_at: None,
            last_consumed_at: None,
        }
    }

    pub fn from_row(row: &NotificationSubscription) -> Self {
        Self {
            subscribed: true,
            active: row.active,
            scope: row.scope.clone(),
            universe_id: row.universe_id,
            unconsumed_count: row.unconsumed_count,
            disabled_reason: row.disabled_reason.clone(),
            disabled_at: row.disabled_at,
            last_consumed_at: row.last_consumed_at,
        }
    }
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct NotificationListRow {
    pub id: Uuid,
    pub kind: String,
    pub story_id: Uuid,
    pub story_title: String,
    pub read_at: Option<OffsetDateTime>,
    pub clicked_at: Option<OffsetDateTime>,
    pub created_at: OffsetDateTime,
    pub scope: String,
    pub target_user_id: Uuid,
    pub target_username: String,
    pub target_avatar_url: Option<String>,
    pub universe_id: Option<Uuid>,
    pub universe_title: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct NotificationListItem {
    pub id: Uuid,
    pub kind: String,
    pub story_id: Uuid,
    pub story_title: String,
    pub read_at: Option<OffsetDateTime>,
    pub clicked_at: Option<OffsetDateTime>,
    pub created_at: OffsetDateTime,
    pub scope: String,
    pub target_user_id: Uuid,
    pub target_username: String,
    pub target_avatar_url: Option<String>,
    pub universe_id: Option<Uuid>,
    pub universe_title: Option<String>,
}

impl From<NotificationListRow> for NotificationListItem {
    fn from(row: NotificationListRow) -> Self {
        Self {
            id: row.id,
            kind: row.kind,
            story_id: row.story_id,
            story_title: row.story_title,
            read_at: row.read_at,
            clicked_at: row.clicked_at,
            created_at: row.created_at,
            scope: row.scope,
            target_user_id: row.target_user_id,
            target_username: row.target_username,
            target_avatar_url: row.target_avatar_url,
            universe_id: row.universe_id,
            universe_title: row.universe_title,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct NotificationListResponse {
    pub items: Vec<NotificationListItem>,
}

#[derive(Debug, Clone, Serialize)]
pub struct UnreadCountResponse {
    pub count: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ConsumeNotificationResponse {
    pub id: Uuid,
    pub read_at: OffsetDateTime,
    pub clicked_at: OffsetDateTime,
    pub subscription_unconsumed_count: i32,
}
