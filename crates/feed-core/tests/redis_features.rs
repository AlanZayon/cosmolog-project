//! Redis Feature Store apply_event + idempotency (skips if redis/pg down).

use feed_core::{claim_event, RedisFeatureStore};
use serde_json::json;
use sqlx::postgres::PgPoolOptions;
use std::time::Duration;
use uuid::Uuid;

#[tokio::test]
async fn feature_store_applies_like_and_idempotent_claim() {
    let redis_url =
        std::env::var("REDIS_FEATURES_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379/1".into());
    let store = match RedisFeatureStore::connect(&redis_url).await {
        Ok(s) => s,
        Err(e) => {
            eprintln!("SKIP redis features test: {e}");
            return;
        }
    };

    let story_id = Uuid::new_v4();
    store
        .apply_event(
            "story.created",
            &json!({ "story_id": story_id.to_string() }),
        )
        .await
        .expect("created");
    store
        .apply_event(
            "story.liked",
            &json!({ "story_id": story_id.to_string(), "liked": true }),
        )
        .await
        .expect("liked");
    let fv = store.get("story", story_id).await.expect("get");
    assert!(fv.get_f64("story.likes_count").unwrap_or(0.0) >= 1.0);

    let db_url = std::env::var("TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://cosmolog:cosmolog@127.0.0.1:5433/cosmolog_test".into());
    let pool = match PgPoolOptions::new()
        .max_connections(1)
        .acquire_timeout(Duration::from_secs(5))
        .connect(&db_url)
        .await
    {
        Ok(p) => p,
        Err(e) => {
            eprintln!("SKIP idempotency (no postgres): {e}");
            return;
        }
    };
    let _ = sqlx::query(
        r#"CREATE TABLE IF NOT EXISTS public.processed_events (
            event_id UUID PRIMARY KEY,
            event_type TEXT NOT NULL,
            processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )"#,
    )
    .execute(&pool)
    .await;

    let eid = Uuid::new_v4();
    assert!(claim_event(&pool, eid, "story.liked").await.unwrap());
    assert!(!claim_event(&pool, eid, "story.liked").await.unwrap());
}
