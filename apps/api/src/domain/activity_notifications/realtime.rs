use std::sync::Arc;
use std::time::Duration;

use futures_util::StreamExt;
use redis::aio::ConnectionManager;
use redis::{AsyncTypedCommands, Client, RedisError};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tokio::sync::broadcast;
use uuid::Uuid;

pub const REDIS_CHANNEL: &str = "cosmolog:activity-notifications:realtime";

const BROADCAST_CAPACITY: usize = 256;
const SUBSCRIBER_RECONNECT_DELAY: Duration = Duration::from_secs(1);

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct ActivityNotificationRealtimeEvent {
    pub recipient_id: Uuid,
    pub notification_id: Uuid,
    pub unread_count: i64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ActivityNotificationCreatedClientEvent {
    #[serde(rename = "type")]
    pub event_type: &'static str,
    pub notification_id: Uuid,
    pub unread_count: i64,
}

impl ActivityNotificationRealtimeEvent {
    pub fn to_client_event(&self) -> ActivityNotificationCreatedClientEvent {
        ActivityNotificationCreatedClientEvent {
            event_type: "activity_notification.created",
            notification_id: self.notification_id,
            unread_count: self.unread_count,
        }
    }
}

#[derive(Debug, Error)]
pub enum PublishError {
    #[error("failed to serialize activity notification realtime event: {0}")]
    Serialize(#[from] serde_json::Error),
    #[error("failed to publish activity notification realtime event to redis: {0}")]
    Redis(#[from] RedisError),
}

#[derive(Clone)]
struct LocalFanout {
    sender: broadcast::Sender<ActivityNotificationRealtimeEvent>,
}

impl LocalFanout {
    fn new() -> Self {
        let (sender, _) = broadcast::channel(BROADCAST_CAPACITY);
        Self { sender }
    }

    fn subscribe(&self) -> broadcast::Receiver<ActivityNotificationRealtimeEvent> {
        self.sender.subscribe()
    }

    fn publish_local(&self, event: ActivityNotificationRealtimeEvent) {
        let _ = self.sender.send(event);
    }
}

enum Backend {
    LocalOnly,
    Redis { publisher: ConnectionManager },
}

#[derive(Clone)]
pub struct ActivityNotificationEventBus {
    local: Arc<LocalFanout>,
    backend: Arc<Backend>,
}

impl ActivityNotificationEventBus {
    pub fn new_local() -> Self {
        Self {
            local: Arc::new(LocalFanout::new()),
            backend: Arc::new(Backend::LocalOnly),
        }
    }

    pub async fn connect(redis_url: &str) -> Result<Self, RedisError> {
        let client = Client::open(redis_url)?;
        let publisher = ConnectionManager::new(client.clone()).await?;
        let local = Arc::new(LocalFanout::new());
        let bus = Self {
            local: local.clone(),
            backend: Arc::new(Backend::Redis { publisher }),
        };
        bus.spawn_subscriber(client, local);
        Ok(bus)
    }

    fn spawn_subscriber(&self, client: Client, local: Arc<LocalFanout>) {
        tokio::spawn(async move {
            loop {
                if let Err(err) = run_redis_subscriber(&client, &local).await {
                    tracing::warn!(
                        event = "activity_notifications.realtime.redis_subscriber_error",
                        error = %err,
                        "redis activity notification subscriber disconnected; reconnecting"
                    );
                }
                tokio::time::sleep(SUBSCRIBER_RECONNECT_DELAY).await;
            }
        });
    }

    pub fn subscribe(&self) -> broadcast::Receiver<ActivityNotificationRealtimeEvent> {
        self.local.subscribe()
    }

    pub async fn publish(
        &self,
        event: ActivityNotificationRealtimeEvent,
    ) -> Result<(), PublishError> {
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

async fn run_redis_subscriber(client: &Client, local: &LocalFanout) -> Result<(), RedisError> {
    let mut pubsub = client.get_async_pubsub().await?;
    pubsub.subscribe(REDIS_CHANNEL).await?;
    let mut stream = pubsub.into_on_message();

    while let Some(message) = stream.next().await {
        let payload: String = message.get_payload()?;
        match serde_json::from_str::<ActivityNotificationRealtimeEvent>(&payload) {
            Ok(event) => local.publish_local(event),
            Err(err) => {
                tracing::warn!(
                    event = "activity_notifications.realtime.redis_payload_invalid",
                    error = %err,
                    payload = %payload,
                    "dropping invalid activity notification realtime payload from redis"
                );
            }
        }
    }

    Ok(())
}
