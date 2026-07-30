use feed_contracts::events::EventEnvelope;
use serde_json::Value;
use sqlx::{PgExecutor, PgPool};
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

pub async fn enqueue<'e, E>(executor: E, envelope: &EventEnvelope<Value>) -> Result<(), sqlx::Error>
where
    E: PgExecutor<'e>,
{
    sqlx::query(
        r#"
        INSERT INTO event_outbox (event_id, event_type, payload, schema_version, producer, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (event_id) DO NOTHING
        "#,
    )
    .bind(envelope.event_id)
    .bind(&envelope.event_type)
    .bind(&envelope.payload)
    .bind(i32::from(envelope.schema_version))
    .bind(&envelope.producer)
    .bind(envelope.occurred_at)
    .execute(executor)
    .await?;
    Ok(())
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
