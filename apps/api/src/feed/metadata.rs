//! Versioned feed metadata (weights, caps).

use serde_json::Value;
use sqlx::PgPool;

#[derive(Debug, Clone)]
pub struct MetadataSnapshot {
    pub version: i32,
    pub value: Value,
}

pub async fn load_weights(pool: &PgPool) -> Result<MetadataSnapshot, sqlx::Error> {
    let row: Option<(Value, i32)> =
        sqlx::query_as("SELECT value, version FROM feed_metadata WHERE key = 'weights.global'")
            .fetch_optional(pool)
            .await?;

    Ok(match row {
        Some((value, version)) => MetadataSnapshot { version, value },
        None => MetadataSnapshot {
            version: 0,
            value: serde_json::json!({
                "recency": 1.0,
                "popularity": 0.6,
                "following": 2.0,
                "max_candidates": 500
            }),
        },
    })
}
