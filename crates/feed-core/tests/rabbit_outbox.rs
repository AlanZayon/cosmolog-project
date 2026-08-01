//! Integration: outbox drain → RabbitMQ (skips if AMQP unreachable).

use feed_contracts::bus::EventBus;
use feed_contracts::events::{EventEnvelope, EventType};
use feed_core::{declare_topology, drain_unpublished, RabbitMqEventBus, FEATURES_QUEUE};
use futures_lite::StreamExt;
use lapin::options::{BasicAckOptions, BasicConsumeOptions};
use lapin::types::FieldTable;
use serde_json::json;
use sqlx::postgres::PgPoolOptions;
use std::time::Duration;
use uuid::Uuid;

fn amqp_url() -> String {
    std::env::var("AMQP_URL").unwrap_or_else(|_| "amqp://guest:guest@127.0.0.1:5672".into())
}

fn database_url() -> String {
    std::env::var("TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://cosmolog:cosmolog@127.0.0.1:5433/cosmolog_test".into())
}

#[tokio::test]
async fn outbox_row_publishes_to_rabbit_features_queue() {
    let bus = match RabbitMqEventBus::connect(&amqp_url()).await {
        Ok(b) => b,
        Err(e) => {
            eprintln!("SKIP rabbit integration: {e}");
            return;
        }
    };

    let pool = match PgPoolOptions::new()
        .max_connections(1)
        .acquire_timeout(Duration::from_secs(5))
        .connect(&database_url())
        .await
    {
        Ok(p) => p,
        Err(e) => {
            eprintln!("SKIP rabbit integration (no postgres): {e}");
            return;
        }
    };

    // Ensure outbox table exists (tests may have created it).
    let _ = sqlx::query(
        r#"CREATE TABLE IF NOT EXISTS public.event_outbox (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            event_id UUID NOT NULL UNIQUE,
            event_type TEXT NOT NULL,
            payload JSONB NOT NULL,
            schema_version INTEGER NOT NULL DEFAULT 1,
            producer TEXT NOT NULL DEFAULT 'api',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            published_at TIMESTAMPTZ,
            attempts INTEGER NOT NULL DEFAULT 0,
            last_error TEXT
        )"#,
    )
    .execute(&pool)
    .await;

    let event_id = Uuid::new_v4();
    let envelope = EventEnvelope::new(
        EventType::StoryCreated,
        json!({
            "story_id": Uuid::new_v4(),
            "author_id": Uuid::new_v4(),
            "universe_id": null,
            "arc_id": null,
            "story_type": "short_story",
            "tags": [],
            "created_at": time::OffsetDateTime::now_utc(),
        }),
    );
    // Preserve known event_id for assertion
    let envelope = EventEnvelope {
        event_id,
        ..envelope
    };

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
    .execute(&pool)
    .await
    .expect("insert outbox");

    let conn = feed_core::topology::connect(&amqp_url()).await.expect("amqp");
    let channel = conn.create_channel().await.expect("channel");
    declare_topology(&channel).await.expect("topology");
    let mut consumer = channel
        .basic_consume(
            FEATURES_QUEUE,
            "feed-core-test",
            BasicConsumeOptions {
                no_ack: false,
                ..BasicConsumeOptions::default()
            },
            FieldTable::default(),
        )
        .await
        .expect("consume");

    let published = drain_unpublished(&pool, &bus, 10).await.expect("drain");
    assert!(published >= 1);

    let got = tokio::time::timeout(Duration::from_secs(5), consumer.next())
        .await
        .expect("timeout waiting for message")
        .expect("consumer closed")
        .expect("delivery");
    let body: EventEnvelope<serde_json::Value> =
        serde_json::from_slice(&got.data).expect("decode");
    assert_eq!(body.event_id, event_id);
    got.ack(BasicAckOptions::default()).await.expect("ack");

    // EventBus trait smoke
    let _ = bus.publish(envelope).await;
}
