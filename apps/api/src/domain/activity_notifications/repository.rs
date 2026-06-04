use sqlx::PgPool;
use time::OffsetDateTime;
use uuid::Uuid;

use super::model::{
    ActivityNotificationListItem, ActivityNotificationListRow, MarkActivityNotificationReadResponse,
    KIND_COLLECTION_SAVED, KIND_COMMENT_MENTION, KIND_PROFILE_ALERT_ACTIVATED,
    KIND_COMMENT_LIKED, KIND_COMMENT_REPLY, KIND_STORY_COMMENT, KIND_UNIVERSE_ALERT_ACTIVATED,
    MarkAllActivityNotificationsReadResponse,
};

const DEFAULT_LIST_LIMIT: i32 = 30;
const MAX_LIST_LIMIT: i32 = 50;

pub fn default_list_limit() -> i32 {
    DEFAULT_LIST_LIMIT
}

pub fn max_list_limit() -> i32 {
    MAX_LIST_LIMIT
}

#[derive(Debug, Clone)]
pub struct DeliveredActivityNotification {
    pub notification_id: Uuid,
    pub recipient_id: Uuid,
}

pub async fn insert_story_comment(
    pool: &PgPool,
    recipient_id: Uuid,
    actor_id: Uuid,
    story_id: Uuid,
    comment_id: Uuid,
) -> Result<Option<DeliveredActivityNotification>, sqlx::Error> {
    if recipient_id == actor_id {
        return Ok(None);
    }
    insert(
        pool,
        recipient_id,
        actor_id,
        KIND_STORY_COMMENT,
        Some(story_id),
        Some(comment_id),
        None,
        None,
    )
    .await
}

pub async fn insert_comment_liked(
    pool: &PgPool,
    recipient_id: Uuid,
    actor_id: Uuid,
    story_id: Uuid,
    comment_id: Uuid,
) -> Result<Option<DeliveredActivityNotification>, sqlx::Error> {
    if recipient_id == actor_id {
        return Ok(None);
    }
    insert(
        pool,
        recipient_id,
        actor_id,
        KIND_COMMENT_LIKED,
        Some(story_id),
        Some(comment_id),
        None,
        None,
    )
    .await
}

pub async fn insert_comment_reply(
    pool: &PgPool,
    recipient_id: Uuid,
    actor_id: Uuid,
    story_id: Uuid,
    comment_id: Uuid,
) -> Result<Option<DeliveredActivityNotification>, sqlx::Error> {
    if recipient_id == actor_id {
        return Ok(None);
    }
    insert(
        pool,
        recipient_id,
        actor_id,
        KIND_COMMENT_REPLY,
        Some(story_id),
        Some(comment_id),
        None,
        None,
    )
    .await
}

pub async fn insert_comment_mention(
    pool: &PgPool,
    recipient_id: Uuid,
    actor_id: Uuid,
    story_id: Uuid,
    comment_id: Uuid,
) -> Result<Option<DeliveredActivityNotification>, sqlx::Error> {
    if recipient_id == actor_id {
        return Ok(None);
    }
    insert(
        pool,
        recipient_id,
        actor_id,
        KIND_COMMENT_MENTION,
        Some(story_id),
        Some(comment_id),
        None,
        None,
    )
    .await
}

pub async fn insert_profile_alert_activated(
    pool: &PgPool,
    recipient_id: Uuid,
    actor_id: Uuid,
) -> Result<Option<DeliveredActivityNotification>, sqlx::Error> {
    if recipient_id == actor_id {
        return Ok(None);
    }
    insert(
        pool,
        recipient_id,
        actor_id,
        KIND_PROFILE_ALERT_ACTIVATED,
        None,
        None,
        None,
        None,
    )
    .await
}

pub async fn insert_universe_alert_activated(
    pool: &PgPool,
    recipient_id: Uuid,
    actor_id: Uuid,
    universe_id: Uuid,
) -> Result<Option<DeliveredActivityNotification>, sqlx::Error> {
    if recipient_id == actor_id {
        return Ok(None);
    }
    insert(
        pool,
        recipient_id,
        actor_id,
        KIND_UNIVERSE_ALERT_ACTIVATED,
        None,
        None,
        Some(universe_id),
        None,
    )
    .await
}

pub async fn insert_collection_saved(
    pool: &PgPool,
    recipient_id: Uuid,
    actor_id: Uuid,
    collection_id: Uuid,
) -> Result<Option<DeliveredActivityNotification>, sqlx::Error> {
    if recipient_id == actor_id {
        return Ok(None);
    }
    insert(
        pool,
        recipient_id,
        actor_id,
        KIND_COLLECTION_SAVED,
        None,
        None,
        None,
        Some(collection_id),
    )
    .await
}

async fn insert(
    pool: &PgPool,
    recipient_id: Uuid,
    actor_id: Uuid,
    kind: &str,
    story_id: Option<Uuid>,
    comment_id: Option<Uuid>,
    universe_id: Option<Uuid>,
    collection_id: Option<Uuid>,
) -> Result<Option<DeliveredActivityNotification>, sqlx::Error> {
    let row: (Uuid,) = sqlx::query_as(
        r#"
        INSERT INTO activity_notifications (
            recipient_id, actor_id, kind, story_id, comment_id, universe_id, collection_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
        "#,
    )
    .bind(recipient_id)
    .bind(actor_id)
    .bind(kind)
    .bind(story_id)
    .bind(comment_id)
    .bind(universe_id)
    .bind(collection_id)
    .fetch_one(pool)
    .await?;

    Ok(Some(DeliveredActivityNotification {
        notification_id: row.0,
        recipient_id,
    }))
}

pub async fn list_for_recipient(
    pool: &PgPool,
    recipient_id: Uuid,
    limit: i32,
) -> Result<Vec<ActivityNotificationListItem>, sqlx::Error> {
    let limit = limit.clamp(1, MAX_LIST_LIMIT);
    let rows = sqlx::query_as::<_, ActivityNotificationListRow>(
        r#"
        SELECT
            n.id,
            n.kind,
            n.read_at,
            n.clicked_at,
            n.created_at,
            n.actor_id,
            ap.username AS actor_username,
            ap.avatar_url AS actor_avatar_url,
            n.story_id,
            s.title AS story_title,
            n.comment_id,
            n.universe_id,
            u.title AS universe_title,
            n.collection_id,
            c.name AS collection_name
        FROM activity_notifications n
        INNER JOIN profiles ap ON ap.user_id = n.actor_id
        LEFT JOIN stories s ON s.id = n.story_id
        LEFT JOIN universes u ON u.id = n.universe_id
        LEFT JOIN library_collections c ON c.id = n.collection_id
        WHERE n.recipient_id = $1
        ORDER BY n.created_at DESC
        LIMIT $2
        "#,
    )
    .bind(recipient_id)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(ActivityNotificationListItem::from).collect())
}

pub async fn unread_count(pool: &PgPool, recipient_id: Uuid) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM activity_notifications WHERE recipient_id = $1 AND read_at IS NULL",
    )
    .bind(recipient_id)
    .fetch_one(pool)
    .await
}

pub async fn mark_read(
    pool: &PgPool,
    notification_id: Uuid,
    recipient_id: Uuid,
) -> Result<Option<MarkActivityNotificationReadResponse>, sqlx::Error> {
    let now = OffsetDateTime::now_utc();
    let row: Option<(Uuid,)> = sqlx::query_as(
        r#"
        UPDATE activity_notifications
        SET read_at = COALESCE(read_at, $3),
            clicked_at = $3
        WHERE id = $1 AND recipient_id = $2
        RETURNING id
        "#,
    )
    .bind(notification_id)
    .bind(recipient_id)
    .bind(now)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|(id,)| MarkActivityNotificationReadResponse {
        id,
        read_at: now,
        clicked_at: now,
    }))
}

pub async fn mark_all_read(
    pool: &PgPool,
    recipient_id: Uuid,
) -> Result<MarkAllActivityNotificationsReadResponse, sqlx::Error> {
    let now = OffsetDateTime::now_utc();
    let result = sqlx::query(
        r#"
        UPDATE activity_notifications
        SET read_at = COALESCE(read_at, $2),
            clicked_at = $2
        WHERE recipient_id = $1 AND read_at IS NULL
        "#,
    )
    .bind(recipient_id)
    .bind(now)
    .execute(pool)
    .await?;

    Ok(MarkAllActivityNotificationsReadResponse {
        marked_count: result.rows_affected() as i64,
    })
}
