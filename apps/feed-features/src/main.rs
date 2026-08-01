//! feed-features: RabbitMQ → Redis Feature Store (likes update FS only).

use anyhow::Context;
use feed_contracts::events::EventEnvelope;
use feed_core::{claim_event, declare_topology, RedisFeatureStore, FEATURES_QUEUE};
use futures_lite::StreamExt;
use lapin::options::{BasicAckOptions, BasicConsumeOptions, BasicNackOptions};
use lapin::types::FieldTable;
use serde_json::Value;
use sqlx::postgres::PgPoolOptions;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let _ = dotenvy::dotenv();
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("feed_features=info".parse()?))
        .init();

    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL required")?;
    let amqp_url =
        std::env::var("AMQP_URL").unwrap_or_else(|_| "amqp://guest:guest@127.0.0.1:5672".into());
    let redis_url = std::env::var("REDIS_FEATURES_URL")
        .unwrap_or_else(|_| "redis://127.0.0.1:6379/1".into());

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;
    let store = RedisFeatureStore::connect(&redis_url).await?;

    let conn = feed_core::topology::connect(&amqp_url).await?;
    let channel = conn.create_channel().await?;
    declare_topology(&channel).await?;

    let mut consumer = channel
        .basic_consume(
            FEATURES_QUEUE,
            "feed-features",
            BasicConsumeOptions::default(),
            FieldTable::default(),
        )
        .await?;

    tracing::info!(
        event = "feed.features.start",
        queue = FEATURES_QUEUE,
        "feed-features started"
    );

    while let Some(delivery) = consumer.next().await {
        let delivery = match delivery {
            Ok(d) => d,
            Err(e) => {
                tracing::error!(event = "feed.features.consume_error", error = %e);
                continue;
            }
        };

        let result = handle_delivery(&pool, &store, &delivery.data).await;
        match result {
            Ok(()) => {
                delivery.ack(BasicAckOptions::default()).await?;
            }
            Err(e) => {
                tracing::warn!(event = "feed.features.handle_error", error = %e);
                delivery
                    .nack(BasicNackOptions {
                        requeue: false,
                        ..BasicNackOptions::default()
                    })
                    .await?;
            }
        }
    }
    Ok(())
}

async fn handle_delivery(
    pool: &sqlx::PgPool,
    store: &RedisFeatureStore,
    data: &[u8],
) -> anyhow::Result<()> {
    let envelope: EventEnvelope<Value> = serde_json::from_slice(data)?;
    let claimed = claim_event(pool, envelope.event_id, &envelope.event_type).await?;
    if !claimed {
        tracing::debug!(
            event = "feed.features.skip_duplicate",
            event_id = %envelope.event_id,
            "already processed"
        );
        return Ok(());
    }
    store
        .apply_event(&envelope.event_type, &envelope.payload)
        .await?;
    tracing::info!(
        event = "feed.features.applied",
        event_type = %envelope.event_type,
        event_id = %envelope.event_id,
        "feature store updated"
    );
    Ok(())
}
