//! feed-relay: poll Postgres outbox → RabbitMQ (no feed logic in API).

use std::time::Duration;

use anyhow::Context;
use feed_core::{drain_unpublished, outbox, RabbitMqEventBus};
use sqlx::postgres::PgPoolOptions;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let _ = dotenvy::dotenv();
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("feed_relay=info".parse()?))
        .init();

    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL required")?;
    let amqp_url = std::env::var("AMQP_URL").unwrap_or_else(|_| "amqp://guest:guest@127.0.0.1:5672".into());
    let poll_ms: u64 = std::env::var("FEED_RELAY_POLL_MS")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(500);
    let batch: i64 = std::env::var("FEED_RELAY_BATCH")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(50);

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .context("connect postgres")?;

    let bus = RabbitMqEventBus::connect(&amqp_url)
        .await
        .context("connect rabbitmq")?;

    tracing::info!(
        event = "feed.relay.start",
        poll_ms,
        batch,
        "feed-relay started"
    );

    let mut tick = tokio::time::interval(Duration::from_millis(poll_ms));
    loop {
        tick.tick().await;
        match drain_unpublished(&pool, &bus, batch).await {
            Ok(n) if n > 0 => {
                tracing::info!(event = "feed.relay.published", count = n, "outbox drained");
            }
            Ok(_) => {}
            Err(e) => {
                tracing::warn!(event = "feed.relay.error", error = %e, "drain failed");
            }
        }
        if let Ok(Some(lag)) = outbox::unpublished_lag_seconds(&pool).await {
            if lag > 5.0 {
                tracing::warn!(event = "feed.outbox.lag", lag_seconds = lag, "outbox lag elevated");
            } else {
                tracing::debug!(event = "feed.outbox.lag", lag_seconds = lag);
            }
        }
    }
}
