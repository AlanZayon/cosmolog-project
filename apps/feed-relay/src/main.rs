//! feed-relay: poll Postgres outbox → RabbitMQ (no feed logic in API).

use std::sync::Arc;
use std::time::Duration;

use anyhow::Context;
use feed_core::{drain_unpublished, outbox, RabbitMqEventBus};
use sqlx::postgres::PgPoolOptions;
use tokio::sync::Notify;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let _ = dotenvy::dotenv();
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("feed_relay=info".parse()?))
        .init();

    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL required")?;
    let amqp_url =
        std::env::var("AMQP_URL").unwrap_or_else(|_| "amqp://guest:guest@127.0.0.1:5672".into());
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

    let shutdown = Arc::new(Notify::new());
    let shutdown_signal = shutdown.clone();
    tokio::spawn(async move {
        wait_for_shutdown_signal().await;
        tracing::info!(event = "feed.relay.shutdown", "shutdown signal received");
        shutdown_signal.notify_waiters();
    });

    tracing::info!(
        event = "feed.relay.start",
        poll_ms,
        batch,
        "feed-relay started"
    );

    let mut consecutive_failures: u32 = 0;
    loop {
        let bus =
            match RabbitMqEventBus::connect_with_retry(&amqp_url, Duration::from_secs(30)).await {
                Ok(b) => b,
                Err(e) => {
                    // connect_with_retry only returns Err if somehow broken; treat as fatal
                    tracing::error!(event = "feed.relay.fatal", error = %e);
                    return Err(e);
                }
            };

        let mut tick = tokio::time::interval(Duration::from_millis(poll_ms));
        loop {
            tokio::select! {
                _ = shutdown.notified() => {
                    tracing::info!(event = "feed.relay.stop", "feed-relay stopped");
                    return Ok(());
                }
                _ = tick.tick() => {}
            }

            match drain_unpublished(&pool, &bus, batch).await {
                Ok(n) if n > 0 => {
                    consecutive_failures = 0;
                    tracing::info!(event = "feed.relay.published", count = n, "outbox drained");
                }
                Ok(_) => {
                    consecutive_failures = 0;
                }
                Err(e) => {
                    consecutive_failures += 1;
                    tracing::warn!(
                        event = "feed.relay.error",
                        error = %e,
                        consecutive_failures,
                        "drain failed"
                    );
                    // Persistent publish failures → reconnect bus
                    if consecutive_failures >= 3 {
                        tracing::warn!(
                            event = "feed.amqp.reconnect",
                            "reconnecting AMQP after persistent drain failures"
                        );
                        break;
                    }
                }
            }
            if let Ok(Some(lag)) = outbox::unpublished_lag_seconds(&pool).await {
                if lag > 5.0 {
                    tracing::warn!(
                        event = "feed.outbox.lag",
                        lag_seconds = lag,
                        "outbox lag elevated"
                    );
                } else {
                    tracing::debug!(event = "feed.outbox.lag", lag_seconds = lag);
                }
            }
        }
    }
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
