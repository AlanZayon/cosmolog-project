use std::sync::Arc;

use serde::Serialize;
use tokio::sync::broadcast;
use uuid::Uuid;

/// In-memory fan-out for notification SSE. Works for a single API instance; for
/// multiple instances use Postgres LISTEN/NOTIFY or Redis Pub/Sub instead.
#[derive(Clone)]
pub struct NotificationEventBus {
    inner: Arc<NotificationEventBusInner>,
}

struct NotificationEventBusInner {
    sender: broadcast::Sender<NotificationRealtimeEvent>,
}

const BROADCAST_CAPACITY: usize = 256;

#[derive(Clone, Debug)]
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

impl NotificationEventBus {
    pub fn new() -> Self {
        let (sender, _) = broadcast::channel(BROADCAST_CAPACITY);
        Self {
            inner: Arc::new(NotificationEventBusInner { sender }),
        }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<NotificationRealtimeEvent> {
        self.inner.sender.subscribe()
    }

    /// Best-effort publish; lagging receivers are dropped by the broadcast channel.
    pub fn publish(&self, event: NotificationRealtimeEvent) {
        let _ = self.inner.sender.send(event);
    }
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
}
