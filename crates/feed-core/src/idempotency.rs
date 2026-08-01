//! Idempotency via `processed_events`.

use sqlx::PgPool;
use uuid::Uuid;

/// Returns true if this is the first time we see `event_id` (row inserted).
pub async fn claim_event(
    pool: &PgPool,
    event_id: Uuid,
    event_type: &str,
) -> Result<bool, sqlx::Error> {
    let inserted = sqlx::query(
        r#"
        INSERT INTO processed_events (event_id, event_type)
        VALUES ($1, $2)
        ON CONFLICT (event_id) DO NOTHING
        "#,
    )
    .bind(event_id)
    .bind(event_type)
    .execute(pool)
    .await?
    .rows_affected();
    Ok(inserted > 0)
}
