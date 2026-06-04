use sqlx::PgPool;

use super::realtime::{ActivityNotificationEventBus, ActivityNotificationRealtimeEvent};
use super::repository::{self, DeliveredActivityNotification};

async fn publish_realtime(
    pool: &PgPool,
    bus: &ActivityNotificationEventBus,
    delivered: DeliveredActivityNotification,
) {
    let unread = match repository::unread_count(pool, delivered.recipient_id).await {
        Ok(count) => count,
        Err(err) => {
            tracing::warn!(
                event = "activity_notifications.realtime.unread_count_failed",
                recipient_id = %delivered.recipient_id,
                error = %err,
                "failed to load unread count for realtime event"
            );
            return;
        }
    };

    if let Err(err) = bus
        .publish(ActivityNotificationRealtimeEvent {
            recipient_id: delivered.recipient_id,
            notification_id: delivered.notification_id,
            unread_count: unread,
        })
        .await
    {
        tracing::warn!(
            event = "activity_notifications.realtime.publish_failed",
            recipient_id = %delivered.recipient_id,
            notification_id = %delivered.notification_id,
            error = %err,
            "failed to publish activity notification realtime event"
        );
    }
}

pub async fn deliver_and_publish(
    pool: &PgPool,
    bus: &ActivityNotificationEventBus,
    delivered: DeliveredActivityNotification,
) {
    publish_realtime(pool, bus, delivered).await;
}

pub async fn deliver_optional(
    pool: &PgPool,
    bus: &ActivityNotificationEventBus,
    delivered: Option<DeliveredActivityNotification>,
) {
    if let Some(d) = delivered {
        deliver_and_publish(pool, bus, d).await;
    }
}
