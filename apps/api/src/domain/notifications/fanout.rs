use sqlx::PgPool;

use crate::domain::stories::Story;

use super::realtime::{NotificationEventBus, NotificationRealtimeEvent};
use super::repository::{
    deliver_notification, list_active_profile_subscriptions, list_active_universe_subscriptions,
    profile_threshold, universe_threshold, unread_count, DeliveredNotification,
};

async fn publish_realtime(
    pool: &PgPool,
    bus: &NotificationEventBus,
    delivered: DeliveredNotification,
) {
    let unread = match unread_count(pool, delivered.recipient_id).await {
        Ok(count) => count,
        Err(err) => {
            tracing::warn!(
                event = "notifications.realtime.unread_count_failed",
                recipient_id = %delivered.recipient_id,
                error = %err,
                "failed to load unread count for realtime event"
            );
            return;
        }
    };

    if let Err(err) = bus
        .publish(NotificationRealtimeEvent {
            recipient_id: delivered.recipient_id,
            notification_id: delivered.notification_id,
            unread_count: unread,
        })
        .await
    {
        tracing::warn!(
            event = "notifications.realtime.publish_failed",
            recipient_id = %delivered.recipient_id,
            notification_id = %delivered.notification_id,
            error = %err,
            "failed to publish notification realtime event"
        );
    }
}

pub async fn fanout_new_story(
    pool: &PgPool,
    bus: &NotificationEventBus,
    story: &Story,
) -> Result<(), sqlx::Error> {
    let profile_subs = list_active_profile_subscriptions(pool, story.author_id).await?;
    for sub in &profile_subs {
        match deliver_notification(pool, sub, story.id, profile_threshold()).await {
            Ok(delivered) => publish_realtime(pool, bus, delivered).await,
            Err(err) => return Err(err),
        }
    }

    if let Some(universe_id) = story.universe_id {
        let universe_subs = list_active_universe_subscriptions(pool, universe_id).await?;
        for sub in &universe_subs {
            match deliver_notification(pool, sub, story.id, universe_threshold()).await {
                Ok(delivered) => publish_realtime(pool, bus, delivered).await,
                Err(err) => return Err(err),
            }
        }
    }

    Ok(())
}
