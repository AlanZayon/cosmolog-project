use std::sync::Arc;
use std::time::Duration;

use futures_util::StreamExt;
use redis::aio::ConnectionManager;
use redis::{AsyncTypedCommands, Client, RedisError};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tokio::sync::broadcast;
use uuid::Uuid;

/// Redis channel for cross-instance notification fan-out.
pub const REDIS_CHANNEL: &str = "cosmolog:notifications:realtime";

const BROADCAST_CAPACITY: usize = 256;
const SUBSCRIBER_RECONNECT_DELAY: Duration = Duration::from_secs(1);

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct NotificationRealtimeEvent {
    pub recipient_id: Uuid,
    pub notification_id: Uuid,
    pub unread_count: i64,
}

/// JSON payload sent over SSE to the browser.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct NotificationCreatedClientEvent {
    #[serde(rename = "type")]
    pub event_type: &'static str,
    pub notification_id: Uuid,
    pub unread_count: i64,
}

impl NotificationRealtimeEvent {
    pub fn to_client_event(&self) -> NotificationCreatedClientEvent {
        NotificationCreatedClientEvent {
            event_type: "notification.created",
            notification_id: self.notification_id,
            unread_count: self.unread_count,
        }
    }
}

#[derive(Debug, Error)]
pub enum PublishError {
    #[error("failed to serialize notification realtime event: {0}")]
    Serialize(#[from] serde_json::Error),
    #[error("failed to publish notification realtime event to redis: {0}")]
    Redis(#[from] RedisError),
}

/// Local broadcast used to fan out events to SSE clients on this API instance.
#[derive(Clone)]
struct LocalNotificationFanout {
    sender: broadcast::Sender<NotificationRealtimeEvent>,
}

impl LocalNotificationFanout {
    fn new() -> Self {
        let (sender, _) = broadcast::channel(BROADCAST_CAPACITY);
        Self { sender }
    }

    fn subscribe(&self) -> broadcast::Receiver<NotificationRealtimeEvent> {
        self.sender.subscribe()
    }

    fn publish_local(&self, event: NotificationRealtimeEvent) {
        let _ = self.sender.send(event);
    }
}

enum Backend {
    LocalOnly,
    Redis { publisher: ConnectionManager },
}

/// Realtime notification bus: Redis Pub/Sub across instances, local broadcast per instance.
#[derive(Clone)]
pub struct NotificationEventBus {
    local: Arc<LocalNotificationFanout>,
    backend: Arc<Backend>,
}

impl NotificationEventBus {
    /// In-memory only (single instance). Used in tests and when `REDIS_URL` is unset.
    pub fn new_local() -> Self {
        Self {
            local: Arc::new(LocalNotificationFanout::new()),
            backend: Arc::new(Backend::LocalOnly),
        }
    }

    /// Connect to Redis, spawn the subscriber task, and use Redis for cross-instance publish.
    pub async fn connect(redis_url: &str) -> Result<Self, RedisError> {
        let client = Client::open(redis_url)?;
        let publisher = ConnectionManager::new(client.clone()).await?;
        let local = Arc::new(LocalNotificationFanout::new());
        let bus = Self {
            local: local.clone(),
            backend: Arc::new(Backend::Redis { publisher }),
        };
        bus.spawn_subscriber(client, local);
        Ok(bus)
    }

    fn spawn_subscriber(&self, client: Client, local: Arc<LocalNotificationFanout>) {
        tokio::spawn(async move {
            loop {
                if let Err(err) = run_redis_subscriber(&client, &local).await {
                    tracing::warn!(
                        event = "notifications.realtime.redis_subscriber_error",
                        error = %err,
                        "redis notification subscriber disconnected; reconnecting"
                    );
                }
                tokio::time::sleep(SUBSCRIBER_RECONNECT_DELAY).await;
            }
        });
    }

    pub fn subscribe(&self) -> broadcast::Receiver<NotificationRealtimeEvent> {
        self.local.subscribe()
    }

    /// Publish a realtime event. With Redis, publishes to the shared channel only (no local
    /// duplicate); this instance receives it back via the Redis subscriber task.
    pub async fn publish(&self, event: NotificationRealtimeEvent) -> Result<(), PublishError> {
        match self.backend.as_ref() {
            Backend::LocalOnly => {
                self.local.publish_local(event);
                Ok(())
            }
            Backend::Redis { publisher } => {
                let payload = serde_json::to_string(&event)?;
                let mut conn = publisher.clone();
                conn.publish(REDIS_CHANNEL, payload).await?;
                Ok(())
            }
        }
    }
}

async fn run_redis_subscriber(
    client: &Client,
    local: &LocalNotificationFanout,
) -> Result<(), RedisError> {
    let mut pubsub = client.get_async_pubsub().await?;
    pubsub.subscribe(REDIS_CHANNEL).await?;
    let mut stream = pubsub.into_on_message();

    while let Some(message) = stream.next().await {
        let payload: String = message.get_payload()?;
        match serde_json::from_str::<NotificationRealtimeEvent>(&payload) {
            Ok(event) => local.publish_local(event),
            Err(err) => {
                tracing::warn!(
                    event = "notifications.realtime.redis_payload_invalid",
                    error = %err,
                    payload = %payload,
                    "dropping invalid notification realtime payload from redis"
                );
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn client_event_serializes_expected_shape() {
        let event = NotificationCreatedClientEvent {
            event_type: "notification.created",
            notification_id: Uuid::nil(),
            unread_count: 3,
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains(r#""type":"notification.created""#));
        assert!(json.contains(r#""unread_count":3"#));
    }

    #[test]
    fn realtime_event_roundtrip_json() {
        let event = NotificationRealtimeEvent {
            recipient_id: Uuid::new_v4(),
            notification_id: Uuid::new_v4(),
            unread_count: 7,
        };
        let json = serde_json::to_string(&event).unwrap();
        let decoded: NotificationRealtimeEvent = serde_json::from_str(&json).unwrap();
        assert_eq!(decoded, event);
    }

    #[tokio::test]
    async fn local_bus_delivers_to_subscriber() {
        let bus = NotificationEventBus::new_local();
        let mut rx = bus.subscribe();
        let event = NotificationRealtimeEvent {
            recipient_id: Uuid::new_v4(),
            notification_id: Uuid::new_v4(),
            unread_count: 1,
        };
        bus.publish(event.clone()).await.unwrap();
        let received = rx.recv().await.unwrap();
        assert_eq!(received, event);
    }

    #[tokio::test]
    async fn local_bus_to_client_event_shape_unchanged() {
        let event = NotificationRealtimeEvent {
            recipient_id: Uuid::new_v4(),
            notification_id: Uuid::new_v4(),
            unread_count: 2,
        };
        let client = event.to_client_event();
        assert_eq!(client.event_type, "notification.created");
        let json = serde_json::to_string(&client).unwrap();
        assert!(json.contains(r#""type":"notification.created""#));
    }
}
