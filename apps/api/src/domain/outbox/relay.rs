use std::sync::Arc;

use feed_contracts::bus::EventBus;
use feed_contracts::events::EventEnvelope;
use sqlx::PgPool;

use super::repository::{self, OutboxRow};

/// Publishes unpublished outbox rows to an [`EventBus`] (Phase A: usually MemoryEventBus).
pub struct OutboxRelay {
    pool: PgPool,
    bus: Arc<dyn EventBus>,
}

impl OutboxRelay {
    pub fn new(pool: PgPool, bus: Arc<dyn EventBus>) -> Self {
        Self { pool, bus }
    }

    pub async fn drain_once(&self, limit: i64) -> Result<usize, String> {
        drain_unpublished(&self.pool, self.bus.as_ref(), limit).await
    }
}

pub async fn drain_unpublished(
    pool: &PgPool,
    bus: &dyn EventBus,
    limit: i64,
) -> Result<usize, String> {
    let rows = repository::list_unpublished(pool, limit)
        .await
        .map_err(|e| e.to_string())?;
    let mut published = 0usize;
    for row in rows {
        if publish_row(pool, bus, &row).await? {
            published += 1;
        }
    }
    Ok(published)
}

async fn publish_row(pool: &PgPool, bus: &dyn EventBus, row: &OutboxRow) -> Result<bool, String> {
    let envelope = EventEnvelope {
        event_id: row.event_id,
        event_type: row.event_type.clone(),
        occurred_at: row.created_at,
        producer: row.producer.clone(),
        schema_version: row.schema_version as u16,
        payload: row.payload.clone(),
    };
    match bus.publish(envelope).await {
        Ok(()) => {
            repository::mark_published(pool, row.id)
                .await
                .map_err(|e| e.to_string())?;
            Ok(true)
        }
        Err(err) => {
            let _ = repository::mark_attempt_failed(pool, row.id, &err.to_string()).await;
            Err(err.to_string())
        }
    }
}
