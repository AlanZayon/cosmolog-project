//! Outbox poll helpers shared by feed-relay.

use feed_contracts::bus::EventBus;
use feed_contracts::events::EventEnvelope;
use serde_json::Value;
use sqlx::PgPool;
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct OutboxRow {
    pub id: Uuid,
    pub event_id: Uuid,
    pub event_type: String,
    pub payload: Value,
    pub schema_version: i32,
    pub producer: String,
    pub created_at: OffsetDateTime,
    pub published_at: Option<OffsetDateTime>,
    pub attempts: i32,
    pub last_error: Option<String>,
}

pub async fn list_unpublished(pool: &PgPool, limit: i64) -> Result<Vec<OutboxRow>, sqlx::Error> {
    sqlx::query_as::<_, OutboxRow>(
        r#"
        SELECT id, event_id, event_type, payload, schema_version, producer,
               created_at, published_at, attempts, last_error
        FROM event_outbox
        WHERE published_at IS NULL
        ORDER BY created_at ASC
        LIMIT $1
        "#,
    )
    .bind(limit)
    .fetch_all(pool)
    .await
}

pub async fn mark_published(pool: &PgPool, id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE event_outbox
        SET published_at = now(), last_error = NULL
        WHERE id = $1
        "#,
    )
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn mark_attempt_failed(
    pool: &PgPool,
    id: Uuid,
    error: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE event_outbox
        SET attempts = attempts + 1, last_error = $2
        WHERE id = $1
        "#,
    )
    .bind(id)
    .bind(error)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn unpublished_lag_seconds(pool: &PgPool) -> Result<Option<f64>, sqlx::Error> {
    let oldest: Option<OffsetDateTime> = sqlx::query_scalar(
        r#"
        SELECT created_at FROM event_outbox
        WHERE published_at IS NULL
        ORDER BY created_at ASC
        LIMIT 1
        "#,
    )
    .fetch_optional(pool)
    .await?;
    Ok(oldest.map(|t| {
        let now = OffsetDateTime::now_utc();
        (now - t).as_seconds_f64()
    }))
}

pub async fn drain_unpublished(
    pool: &PgPool,
    bus: &dyn EventBus,
    limit: i64,
) -> Result<usize, String> {
    let rows = list_unpublished(pool, limit)
        .await
        .map_err(|e| e.to_string())?;
    let mut published = 0usize;
    for row in rows {
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
                mark_published(pool, row.id)
                    .await
                    .map_err(|e| e.to_string())?;
                published += 1;
            }
            Err(err) => {
                let _ = mark_attempt_failed(pool, row.id, &err.to_string()).await;
                return Err(err.to_string());
            }
        }
    }
    Ok(published)
}
