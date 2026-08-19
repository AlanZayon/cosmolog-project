//! feed-features: RabbitMQ → Redis Feature Store (likes update FS only).

use std::sync::Arc;
use std::time::Duration;

use anyhow::Context;
use feed_contracts::events::EventEnvelope;
use feed_core::{
    claim_event, connect_with_retry, declare_topology, RedisFeatureStore, FEATURES_QUEUE,
};
use futures_lite::StreamExt;
use lapin::options::{BasicAckOptions, BasicConsumeOptions, BasicNackOptions, BasicQosOptions};
use lapin::types::FieldTable;
use serde_json::Value;
use sqlx::postgres::PgPoolOptions;
use tokio::sync::Notify;
use tracing_subscriber::EnvFilter;

const PREFETCH: u16 = 10;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let _ = dotenvy::dotenv();
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("feed_features=info".parse()?))
        .init();

    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL required")?;
    let amqp_url =
        std::env::var("AMQP_URL").unwrap_or_else(|_| "amqp://guest:guest@127.0.0.1:5672".into());
    let redis_url =
        std::env::var("REDIS_FEATURES_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379/1".into());

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;
    let store = RedisFeatureStore::connect(&redis_url).await?;

    let shutdown = Arc::new(Notify::new());
    let shutdown_signal = shutdown.clone();
    tokio::spawn(async move {
        wait_for_shutdown_signal().await;
        tracing::info!(event = "feed.features.shutdown", "shutdown signal received");
        shutdown_signal.notify_waiters();
    });

    tracing::info!(
        event = "feed.features.start",
        queue = FEATURES_QUEUE,
        "feed-features started"
    );

    loop {
        tokio::select! {
            _ = shutdown.notified() => {
                tracing::info!(event = "feed.features.stop", "feed-features stopped");
                return Ok(());
            }
            result = run_once(&pool, &store, &amqp_url, &shutdown) => {
                match result {
                    Ok(()) => {
                        tracing::warn!(
                            event = "feed.amqp.reconnect",
                            "consumer stream ended; reconnecting"
                        );
                    }
                    Err(e) => {
                        tracing::error!(
                            event = "feed.features.run_error",
                            error = %e,
                            "run_once failed; reconnecting"
                        );
                    }
                }
                // Brief pause before reconnect so we don't spin on a hard fail
                tokio::select! {
                    _ = shutdown.notified() => {
                        tracing::info!(event = "feed.features.stop", "feed-features stopped");
                        return Ok(());
                    }
                    _ = tokio::time::sleep(Duration::from_secs(1)) => {}
                }
            }
        }
    }
}

async fn run_once(
    pool: &sqlx::PgPool,
    store: &RedisFeatureStore,
    amqp_url: &str,
    shutdown: &Notify,
) -> anyhow::Result<()> {
    let conn = connect_with_retry(amqp_url, Duration::from_secs(30)).await?;
    let channel = conn.create_channel().await?;
    declare_topology(&channel).await?;
    channel
        .basic_qos(PREFETCH, BasicQosOptions::default())
        .await?;

    let mut consumer = channel
        .basic_consume(
            FEATURES_QUEUE,
            "feed-features",
            BasicConsumeOptions::default(),
            FieldTable::default(),
        )
        .await?;

    loop {
        tokio::select! {
            _ = shutdown.notified() => {
                return Ok(());
            }
            delivery = consumer.next() => {
                let Some(delivery) = delivery else {
                    // Stream ended (broker disconnect) → reconnect
                    return Ok(());
                };
                let delivery = match delivery {
                    Ok(d) => d,
                    Err(e) => {
                        tracing::error!(event = "feed.features.consume_error", error = %e);
                        return Err(e.into());
                    }
                };

                let result = handle_delivery(pool, store, &delivery.data).await;
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
        }
    }
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

async fn wait_for_shutdown_signal() {
    let ctrl_c = tokio::signal::ctrl_c();
    #[cfg(unix)]
    {
        let mut sigterm = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("install SIGTERM handler");
        tokio::select! {
            _ = ctrl_c => {}
            _ = sigterm.recv() => {}
        }
    }
    #[cfg(not(unix))]
    {
        let _ = ctrl_c.await;
    }
}
