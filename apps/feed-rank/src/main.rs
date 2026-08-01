//! feed-rank: rebuild timelines on StoryCreated/Follow; scheduler for discovery.

use std::sync::Arc;
use std::time::Duration;

use anyhow::Context;
use feed_contracts::events::EventEnvelope;
use feed_core::{
    declare_topology, list_universe_followers, rebuild_user_timeline, RedisFeatureStore,
    RedisTimelineStore, RebuildDeps, COMMANDS_EXCHANGE, RANK_QUEUE,
};
use futures_lite::StreamExt;
use lapin::options::{BasicAckOptions, BasicConsumeOptions, BasicNackOptions, BasicPublishOptions};
use lapin::types::FieldTable;
use lapin::BasicProperties;
use serde_json::{json, Value};
use sqlx::postgres::PgPoolOptions;
use tracing_subscriber::EnvFilter;
use uuid::Uuid;

const CELEBRITY_FOLLOWER_CAP: i64 = 2_000;

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
    let weights = load_weights(&pool).await.unwrap_or_else(|_| json!({
        "recency": 1.0,
        "popularity": 0.6,
        "following": 2.0
    }));

    let deps = Arc::new(RebuildDeps {
        pool: pool.clone(),
        features,
        timelines,
        weights,
    });

    let conn = feed_core::topology::connect(&amqp_url).await?;
    let channel = conn.create_channel().await?;
    declare_topology(&channel).await?;
    let publish_channel = conn.create_channel().await?;

    let deps_sched = deps.clone();
    let sched_channel = publish_channel.clone();
    tokio::spawn(async move {
        let mut tick = tokio::time::interval(Duration::from_secs(scheduler_secs));
        loop {
            tick.tick().await;
            if let Err(e) = scheduler_tick(&deps_sched, &sched_channel).await {
                tracing::warn!(event = "feed.scheduler.error", error = %e);
            }
        }
    });

    let mut consumer = channel
        .basic_consume(
            RANK_QUEUE,
            "feed-rank",
            BasicConsumeOptions::default(),
            FieldTable::default(),
        )
        .await?;

    tracing::info!(
        event = "feed.rank.start",
        queue = RANK_QUEUE,
        scheduler_secs,
        "feed-rank started"
    );

    while let Some(delivery) = consumer.next().await {
        let delivery = match delivery {
            Ok(d) => d,
            Err(e) => {
                tracing::error!(event = "feed.rank.consume_error", error = %e);
                continue;
            }
        };
        match handle_message(&deps, &delivery.data).await {
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
    Ok(())
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

async fn scheduler_tick(
    deps: &RebuildDeps,
    channel: &lapin::Channel,
) -> anyhow::Result<()> {
    tracing::info!(event = "feed.scheduler.tick", "discovery/trending tick");
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
