//! feed-rank: rebuild timelines on StoryCreated/Follow; scheduler for discovery.

use std::sync::Arc;
use std::time::Duration;

use anyhow::Context;
use feed_contracts::events::EventEnvelope;
use feed_core::{
    connect_with_retry, declare_topology, list_universe_followers, rebuild_user_timeline,
    RedisFeatureStore, RedisTimelineStore, RebuildDeps, COMMANDS_EXCHANGE, RANK_QUEUE,
};
use futures_lite::StreamExt;
use lapin::options::{
    BasicAckOptions, BasicConsumeOptions, BasicNackOptions, BasicPublishOptions, BasicQosOptions,
};
use lapin::types::FieldTable;
use lapin::BasicProperties;
use serde_json::{json, Value};
use sqlx::postgres::PgPoolOptions;
use tokio::sync::Notify;
use tracing_subscriber::EnvFilter;
use uuid::Uuid;

const CELEBRITY_FOLLOWER_CAP: i64 = 2_000;
const PREFETCH: u16 = 1;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let _ = dotenvy::dotenv();
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("feed_rank=info".parse()?))
        .init();

    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL required")?;
    let amqp_url =
        std::env::var("AMQP_URL").unwrap_or_else(|_| "amqp://guest:guest@127.0.0.1:5672".into());
    let features_url = std::env::var("REDIS_FEATURES_URL")
        .unwrap_or_else(|_| "redis://127.0.0.1:6379/1".into());
    let feed_url =
        std::env::var("REDIS_FEED_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379/2".into());
    let scheduler_secs: u64 = std::env::var("FEED_SCHEDULER_SECS")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(300);

    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await?;
    let features = RedisFeatureStore::connect(&features_url).await?;
    let timelines = RedisTimelineStore::connect(&feed_url).await?;
    let weights = load_weights(&pool).await.unwrap_or_else(|_| {
        json!({
            "recency": 1.0,
            "popularity": 0.6,
            "following": 2.0
        })
    });

    let deps = Arc::new(RebuildDeps {
        pool: pool.clone(),
        features,
        timelines,
        weights,
    });

    let shutdown = Arc::new(Notify::new());
    let shutdown_signal = shutdown.clone();
    tokio::spawn(async move {
        wait_for_shutdown_signal().await;
        tracing::info!(event = "feed.rank.shutdown", "shutdown signal received");
        shutdown_signal.notify_waiters();
    });

    // Scheduler publishes discovery ticks; reconnects its own channel on failure.
    let deps_sched = deps.clone();
    let amqp_sched = amqp_url.clone();
    let shutdown_sched = shutdown.clone();
    tokio::spawn(async move {
        scheduler_loop(&deps_sched, &amqp_sched, scheduler_secs, &shutdown_sched).await;
    });

    tracing::info!(
        event = "feed.rank.start",
        queue = RANK_QUEUE,
        scheduler_secs,
        "feed-rank started"
    );

    loop {
        tokio::select! {
            _ = shutdown.notified() => {
                tracing::info!(event = "feed.rank.stop", "feed-rank stopped");
                return Ok(());
            }
            result = run_once(&deps, &amqp_url, &shutdown) => {
                match result {
                    Ok(()) => {
                        tracing::warn!(
                            event = "feed.amqp.reconnect",
                            "consumer stream ended; reconnecting"
                        );
                    }
                    Err(e) => {
                        tracing::error!(
                            event = "feed.rank.run_error",
                            error = %e,
                            "run_once failed; reconnecting"
                        );
                    }
                }
                tokio::select! {
                    _ = shutdown.notified() => {
                        tracing::info!(event = "feed.rank.stop", "feed-rank stopped");
                        return Ok(());
                    }
                    _ = tokio::time::sleep(Duration::from_secs(1)) => {}
                }
            }
        }
    }
}

async fn run_once(
    deps: &RebuildDeps,
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
            RANK_QUEUE,
            "feed-rank",
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
                    return Ok(());
                };
                let delivery = match delivery {
                    Ok(d) => d,
                    Err(e) => {
                        tracing::error!(event = "feed.rank.consume_error", error = %e);
                        return Err(e.into());
                    }
                };
                match handle_message(deps, &delivery.data).await {
                    Ok(()) => delivery.ack(BasicAckOptions::default()).await?,
                    Err(e) => {
                        tracing::warn!(event = "feed.rank.handle_error", error = %e);
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

async fn scheduler_loop(
    deps: &RebuildDeps,
    amqp_url: &str,
    scheduler_secs: u64,
    shutdown: &Notify,
) {
    let mut tick = tokio::time::interval(Duration::from_secs(scheduler_secs));
    loop {
        tokio::select! {
            _ = shutdown.notified() => return,
            _ = tick.tick() => {}
        }
        if let Err(e) = scheduler_tick(deps, amqp_url).await {
            tracing::warn!(event = "feed.scheduler.error", error = %e);
        }
    }
}

async fn load_weights(pool: &sqlx::PgPool) -> anyhow::Result<Value> {
    let row: Option<(Value,)> =
        sqlx::query_as("SELECT value FROM feed_metadata WHERE key = 'weights.global'")
            .fetch_optional(pool)
            .await?;
    Ok(row.map(|(v,)| v).unwrap_or_else(|| json!({})))
}

async fn handle_message(deps: &RebuildDeps, data: &[u8]) -> anyhow::Result<()> {
    // Command messages
    if let Ok(cmd) = serde_json::from_slice::<Value>(data) {
        if cmd.get("kind").and_then(|v| v.as_str()) == Some("rebuild_user") {
            if let Some(uid) = cmd.get("user_id").and_then(|v| v.as_str()) {
                let user_id = Uuid::parse_str(uid)?;
                let n = rebuild_user_timeline(deps, user_id).await?;
                tracing::info!(
                    event = "feed.rank.rebuild_user",
                    user_id = %user_id,
                    items = n,
                    "timeline rebuilt"
                );
                return Ok(());
            }
        }
        if cmd.get("kind").and_then(|v| v.as_str()) == Some("discovery_tick") {
            return discovery_sample_rebuild(deps).await;
        }
    }

    let envelope: EventEnvelope<Value> = serde_json::from_slice(data)?;
    match envelope.event_type.as_str() {
        "story.created" => {
            let universe_id = envelope
                .payload
                .get("universe_id")
                .and_then(|v| v.as_str())
                .and_then(|s| Uuid::parse_str(s).ok());
            let author_id = envelope
                .payload
                .get("author_id")
                .and_then(|v| v.as_str())
                .and_then(|s| Uuid::parse_str(s).ok());

            let mut users = Vec::new();
            if let Some(uid) = universe_id {
                users.extend(
                    list_universe_followers(&deps.pool, uid, CELEBRITY_FOLLOWER_CAP).await?,
                );
            }
            if let Some(aid) = author_id {
                if !users.contains(&aid) {
                    users.push(aid);
                }
            }
            for user_id in users {
                let n = rebuild_user_timeline(deps, user_id).await?;
                tracing::info!(
                    event = "feed.rank.rebuild_after_story",
                    user_id = %user_id,
                    items = n
                );
            }
        }
        "universe.followed" | "universe.unfollowed" => {
            // Likes must NOT full-rebuild; follow/unfollow rebuild only that user.
            let user_id = envelope
                .payload
                .get("user_id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| anyhow::anyhow!("missing user_id"))
                .and_then(|s| Uuid::parse_str(s).map_err(|e| e.into()))?;
            let n = rebuild_user_timeline(deps, user_id).await?;
            tracing::info!(
                event = "feed.rank.rebuild_after_follow",
                user_id = %user_id,
                items = n
            );
        }
        "story.liked" | "story.unliked" => {
            // Features-only: ignore for timeline rebuild.
            tracing::debug!(
                event = "feed.rank.skip_like",
                "likes do not trigger full rebuild"
            );
        }
        _ => {}
    }
    Ok(())
}

async fn scheduler_tick(deps: &RebuildDeps, amqp_url: &str) -> anyhow::Result<()> {
    tracing::info!(event = "feed.scheduler.tick", "discovery/trending tick");
    let conn = connect_with_retry(amqp_url, Duration::from_secs(30)).await?;
    let channel = conn.create_channel().await?;
    declare_topology(&channel).await?;
    let body = serde_json::to_vec(&json!({ "kind": "discovery_tick" }))?;
    channel
        .basic_publish(
            COMMANDS_EXCHANGE,
            "feed.rebuild.discovery",
            BasicPublishOptions::default(),
            &body,
            BasicProperties::default()
                .with_content_type("application/json".into())
                .with_delivery_mode(2),
        )
        .await?
        .await?;
    let _ = deps;
    Ok(())
}

async fn discovery_sample_rebuild(deps: &RebuildDeps) -> anyhow::Result<()> {
    // Sample cold/active users: recent followers + recent story authors.
    let users: Vec<(Uuid,)> = sqlx::query_as(
        r#"
        (
          SELECT user_id AS id FROM universe_follows ORDER BY created_at DESC LIMIT 25
        )
        UNION
        (
          SELECT author_id AS id FROM stories ORDER BY created_at DESC LIMIT 25
        )
        "#,
    )
    .fetch_all(&deps.pool)
    .await
    .unwrap_or_default();

    for (user_id,) in users {
        if let Err(e) = rebuild_user_timeline(deps, user_id).await {
            tracing::warn!(
                event = "feed.scheduler.rebuild_error",
                user_id = %user_id,
                error = %e
            );
        }
    }
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
