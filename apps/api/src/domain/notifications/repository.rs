use sqlx::PgPool;
use time::OffsetDateTime;
use uuid::Uuid;

use crate::domain::limits::{
    DEFAULT_NOTIFICATIONS_LIST_LIMIT, MAX_NOTIFICATIONS_LIST_LIMIT,
    PROFILE_NOTIFICATION_UNCONSUMED_THRESHOLD, UNIVERSE_NOTIFICATION_UNCONSUMED_THRESHOLD,
};

use super::model::{
    ConsumeNotificationResponse, Notification, NotificationListItem, NotificationListRow,
    NotificationSubscription, SubscriptionStatus,
};

pub async fn count_stories_by_author(pool: &PgPool, author_id: Uuid) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM stories WHERE author_id = $1",
    )
    .bind(author_id)
    .fetch_one(pool)
    .await
}

pub async fn find_universe_owner(
    pool: &PgPool,
    universe_id: Uuid,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar("SELECT owner_id FROM universes WHERE id = $1")
        .bind(universe_id)
        .fetch_optional(pool)
        .await
}

pub async fn find_profile_subscription(
    pool: &PgPool,
    subscriber_id: Uuid,
    target_user_id: Uuid,
) -> Result<Option<NotificationSubscription>, sqlx::Error> {
    sqlx::query_as::<_, NotificationSubscription>(
        r#"
        SELECT id, subscriber_id, target_user_id, scope, universe_id, active,
               unconsumed_count, disabled_at, disabled_reason, last_consumed_at,
               created_at, updated_at
        FROM notification_subscriptions
        WHERE subscriber_id = $1 AND target_user_id = $2 AND scope = 'profile'
        "#,
    )
    .bind(subscriber_id)
    .bind(target_user_id)
    .fetch_optional(pool)
    .await
}

pub async fn find_universe_subscription(
    pool: &PgPool,
    subscriber_id: Uuid,
    universe_id: Uuid,
) -> Result<Option<NotificationSubscription>, sqlx::Error> {
    sqlx::query_as::<_, NotificationSubscription>(
        r#"
        SELECT id, subscriber_id, target_user_id, scope, universe_id, active,
               unconsumed_count, disabled_at, disabled_reason, last_consumed_at,
               created_at, updated_at
        FROM notification_subscriptions
        WHERE subscriber_id = $1 AND universe_id = $2 AND scope = 'universe'
        "#,
    )
    .bind(subscriber_id)
    .bind(universe_id)
    .fetch_optional(pool)
    .await
}

pub async fn upsert_profile_subscription(
    pool: &PgPool,
    subscriber_id: Uuid,
    target_user_id: Uuid,
) -> Result<NotificationSubscription, sqlx::Error> {
    sqlx::query_as::<_, NotificationSubscription>(
        r#"
        INSERT INTO notification_subscriptions (
            subscriber_id, target_user_id, scope, active, unconsumed_count,
            disabled_at, disabled_reason
        )
        VALUES ($1, $2, 'profile', true, 0, NULL, NULL)
        ON CONFLICT (subscriber_id, target_user_id) WHERE scope = 'profile'
        DO UPDATE SET
            active = true,
            unconsumed_count = 0,
            disabled_at = NULL,
            disabled_reason = NULL,
            updated_at = now()
        RETURNING id, subscriber_id, target_user_id, scope, universe_id, active,
                  unconsumed_count, disabled_at, disabled_reason, last_consumed_at,
                  created_at, updated_at
        "#,
    )
    .bind(subscriber_id)
    .bind(target_user_id)
    .fetch_one(pool)
    .await
}

pub async fn upsert_universe_subscription(
    pool: &PgPool,
    subscriber_id: Uuid,
    target_user_id: Uuid,
    universe_id: Uuid,
) -> Result<NotificationSubscription, sqlx::Error> {
    sqlx::query_as::<_, NotificationSubscription>(
        r#"
        INSERT INTO notification_subscriptions (
            subscriber_id, target_user_id, scope, universe_id, active, unconsumed_count,
            disabled_at, disabled_reason
        )
        VALUES ($1, $2, 'universe', $3, true, 0, NULL, NULL)
        ON CONFLICT (subscriber_id, universe_id) WHERE scope = 'universe'
        DO UPDATE SET
            active = true,
            unconsumed_count = 0,
            disabled_at = NULL,
            disabled_reason = NULL,
            updated_at = now()
        RETURNING id, subscriber_id, target_user_id, scope, universe_id, active,
                  unconsumed_count, disabled_at, disabled_reason, last_consumed_at,
                  created_at, updated_at
        "#,
    )
    .bind(subscriber_id)
    .bind(target_user_id)
    .bind(universe_id)
    .fetch_one(pool)
    .await
}

pub async fn deactivate_profile_subscription(
    pool: &PgPool,
    subscriber_id: Uuid,
    target_user_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        r#"
        UPDATE notification_subscriptions
        SET active = false,
            disabled_reason = 'user',
            disabled_at = now(),
            updated_at = now()
        WHERE subscriber_id = $1 AND target_user_id = $2 AND scope = 'profile'
        "#,
    )
    .bind(subscriber_id)
    .bind(target_user_id)
    .execute(pool)
    .await?;
    Ok(result.rows_affected() > 0)
}

pub async fn deactivate_universe_subscription(
    pool: &PgPool,
    subscriber_id: Uuid,
    universe_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        r#"
        UPDATE notification_subscriptions
        SET active = false,
            disabled_reason = 'user',
            disabled_at = now(),
            updated_at = now()
        WHERE subscriber_id = $1 AND universe_id = $2 AND scope = 'universe'
        "#,
    )
    .bind(subscriber_id)
    .bind(universe_id)
    .execute(pool)
    .await?;
    Ok(result.rows_affected() > 0)
}

pub async fn profile_subscription_status(
    pool: &PgPool,
    subscriber_id: Uuid,
    target_user_id: Uuid,
) -> Result<SubscriptionStatus, sqlx::Error> {
    let row = find_profile_subscription(pool, subscriber_id, target_user_id).await?;
    Ok(match row {
        Some(r) => SubscriptionStatus::from_row(&r),
        None => SubscriptionStatus::not_subscribed("profile"),
    })
}

pub async fn universe_subscription_status(
    pool: &PgPool,
    subscriber_id: Uuid,
    universe_id: Uuid,
) -> Result<SubscriptionStatus, sqlx::Error> {
    let row = find_universe_subscription(pool, subscriber_id, universe_id).await?;
    Ok(match row {
        Some(r) => {
            let mut status = SubscriptionStatus::from_row(&r);
            status.universe_id = Some(universe_id);
            status
        }
        None => {
            let mut status = SubscriptionStatus::not_subscribed("universe");
            status.universe_id = Some(universe_id);
            status
        }
    })
}

pub async fn list_active_profile_subscriptions(
    pool: &PgPool,
    author_id: Uuid,
) -> Result<Vec<NotificationSubscription>, sqlx::Error> {
    sqlx::query_as::<_, NotificationSubscription>(
        r#"
        SELECT id, subscriber_id, target_user_id, scope, universe_id, active,
               unconsumed_count, disabled_at, disabled_reason, last_consumed_at,
               created_at, updated_at
        FROM notification_subscriptions
        WHERE target_user_id = $1 AND scope = 'profile' AND active = true
        "#,
    )
    .bind(author_id)
    .fetch_all(pool)
    .await
}

pub async fn list_active_universe_subscriptions(
    pool: &PgPool,
    universe_id: Uuid,
) -> Result<Vec<NotificationSubscription>, sqlx::Error> {
    sqlx::query_as::<_, NotificationSubscription>(
        r#"
        SELECT id, subscriber_id, target_user_id, scope, universe_id, active,
               unconsumed_count, disabled_at, disabled_reason, last_consumed_at,
               created_at, updated_at
        FROM notification_subscriptions
        WHERE universe_id = $1 AND scope = 'universe' AND active = true
        "#,
    )
    .bind(universe_id)
    .fetch_all(pool)
    .await
}

#[derive(Debug, Clone, Copy)]
pub struct DeliveredNotification {
    pub notification_id: Uuid,
    pub recipient_id: Uuid,
}

pub async fn deliver_notification(
    pool: &PgPool,
    subscription: &NotificationSubscription,
    story_id: Uuid,
    threshold: i32,
) -> Result<DeliveredNotification, sqlx::Error> {
    let mut tx = pool.begin().await?;

    let inserted = sqlx::query_as::<_, (Uuid,)>(
        r#"
        INSERT INTO notifications (recipient_id, subscription_id, story_id, kind)
        VALUES ($1, $2, $3, 'new_story')
        RETURNING id
        "#,
    )
    .bind(subscription.subscriber_id)
    .bind(subscription.id)
    .bind(story_id)
    .fetch_one(&mut *tx)
    .await?;

    let updated = sqlx::query_as::<_, (i32,)>(
        r#"
        UPDATE notification_subscriptions
        SET unconsumed_count = unconsumed_count + 1,
            updated_at = now()
        WHERE id = $1
        RETURNING unconsumed_count
        "#,
    )
    .bind(subscription.id)
    .fetch_one(&mut *tx)
    .await?;

    if updated.0 >= threshold {
        sqlx::query(
            r#"
            UPDATE notification_subscriptions
            SET active = false,
                disabled_reason = 'unconsumed_threshold',
                disabled_at = now(),
                updated_at = now()
            WHERE id = $1
            "#,
        )
        .bind(subscription.id)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    Ok(DeliveredNotification {
        notification_id: inserted.0,
        recipient_id: subscription.subscriber_id,
    })
}

pub async fn list_for_recipient(
    pool: &PgPool,
    recipient_id: Uuid,
    limit: i32,
) -> Result<Vec<NotificationListItem>, sqlx::Error> {
    let limit = limit.clamp(1, MAX_NOTIFICATIONS_LIST_LIMIT);
    let rows = sqlx::query_as::<_, NotificationListRow>(
        r#"
        SELECT
            n.id,
            n.kind,
            n.story_id,
            s.title AS story_title,
            n.read_at,
            n.clicked_at,
            n.created_at,
            sub.scope,
            sub.target_user_id,
            p.username AS target_username,
            p.avatar_url AS target_avatar_url,
            sub.universe_id,
            u.title AS universe_title
        FROM notifications n
        INNER JOIN notification_subscriptions sub ON sub.id = n.subscription_id
        INNER JOIN stories s ON s.id = n.story_id
        INNER JOIN profiles p ON p.user_id = sub.target_user_id
        LEFT JOIN universes u ON u.id = sub.universe_id
        WHERE n.recipient_id = $1
        ORDER BY n.created_at DESC
        LIMIT $2
        "#,
    )
    .bind(recipient_id)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(NotificationListItem::from).collect())
}

pub async fn unread_count(pool: &PgPool, recipient_id: Uuid) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM notifications WHERE recipient_id = $1 AND read_at IS NULL",
    )
    .bind(recipient_id)
    .fetch_one(pool)
    .await
}

pub async fn find_notification_for_recipient(
    pool: &PgPool,
    notification_id: Uuid,
    recipient_id: Uuid,
) -> Result<Option<Notification>, sqlx::Error> {
    sqlx::query_as::<_, Notification>(
        r#"
        SELECT id, recipient_id, subscription_id, story_id, kind, read_at, clicked_at, created_at
        FROM notifications
        WHERE id = $1 AND recipient_id = $2
        "#,
    )
    .bind(notification_id)
    .bind(recipient_id)
    .fetch_optional(pool)
    .await
}

pub async fn consume(
    pool: &PgPool,
    notification_id: Uuid,
    recipient_id: Uuid,
) -> Result<Option<ConsumeNotificationResponse>, sqlx::Error> {
    let Some(notification) =
        find_notification_for_recipient(pool, notification_id, recipient_id).await?
    else {
        return Ok(None);
    };

    let now = OffsetDateTime::now_utc();
    let mut tx = pool.begin().await?;

    sqlx::query(
        r#"
        UPDATE notifications
        SET read_at = $2, clicked_at = $2
        WHERE id = $1
        "#,
    )
    .bind(notification_id)
    .bind(now)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"
        UPDATE notification_subscriptions
        SET unconsumed_count = 0,
            last_consumed_at = $2,
            updated_at = now()
        WHERE id = $1
        "#,
    )
    .bind(notification.subscription_id)
    .bind(now)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Some(ConsumeNotificationResponse {
        id: notification_id,
        read_at: now,
        clicked_at: now,
        subscription_unconsumed_count: 0,
    }))
}

pub fn profile_threshold() -> i32 {
    PROFILE_NOTIFICATION_UNCONSUMED_THRESHOLD
}

pub fn universe_threshold() -> i32 {
    UNIVERSE_NOTIFICATION_UNCONSUMED_THRESHOLD
}

pub fn default_list_limit() -> i32 {
    DEFAULT_NOTIFICATIONS_LIST_LIMIT
}
