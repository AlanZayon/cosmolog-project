use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::{Arc, Mutex};
use thiserror::Error;
use time::OffsetDateTime;
use uuid::Uuid;

use crate::events::EventEnvelope;

#[derive(Debug, Error)]
pub enum EventPublishError {
    #[error("event bus publish failed: {0}")]
    Transport(String),
}

/// Broker-agnostic publish port (NATS / RabbitMQ / Redpanda adapters implement this).
#[async_trait]
pub trait EventBus: Send + Sync {
    async fn publish(&self, envelope: EventEnvelope<Value>) -> Result<(), EventPublishError>;
}

/// In-memory bus for tests and Phase A default (no external broker required).
#[derive(Clone, Default)]
pub struct MemoryEventBus {
    published: Arc<Mutex<Vec<EventEnvelope<Value>>>>,
}

impl MemoryEventBus {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn published(&self) -> Vec<EventEnvelope<Value>> {
        self.published.lock().expect("bus lock").clone()
    }

    pub fn clear(&self) {
        self.published.lock().expect("bus lock").clear();
    }
}

#[async_trait]
impl EventBus for MemoryEventBus {
    async fn publish(&self, envelope: EventEnvelope<Value>) -> Result<(), EventPublishError> {
        self.published
            .lock()
            .map_err(|e| EventPublishError::Transport(e.to_string()))?
            .push(envelope);
        Ok(())
    }
}

/// Helper to build a JSON envelope quickly.
pub fn envelope_json(event_type: &str, producer: &str, payload: Value) -> EventEnvelope<Value> {
    EventEnvelope {
        event_id: Uuid::new_v4(),
        event_type: event_type.to_string(),
        occurred_at: OffsetDateTime::now_utc(),
        producer: producer.to_string(),
        schema_version: 1,
        payload,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BusHealth {
    pub backend: String,
}
