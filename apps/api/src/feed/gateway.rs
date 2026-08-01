use std::sync::Arc;

use feed_contracts::gateway::FeedGateway;
use feed_contracts::policy::AllowAllPolicy;
use feed_core::RedisTimelineStore;
use sqlx::PgPool;

use super::materializer::TimelineMaterializer;
use super::sql_gateway::SqlFeedGateway;

pub fn build_feed_gateway(
    pool: PgPool,
    mode: feed_contracts::gateway::FeedSourceMode,
    materializer: TimelineMaterializer,
) -> Arc<dyn FeedGateway> {
    build_feed_gateway_with_redis(pool, mode, materializer, None)
}

pub fn build_feed_gateway_with_redis(
    pool: PgPool,
    mode: feed_contracts::gateway::FeedSourceMode,
    materializer: TimelineMaterializer,
    redis_timelines: Option<RedisTimelineStore>,
) -> Arc<dyn FeedGateway> {
    Arc::new(SqlFeedGateway::with_redis(
        pool,
        Arc::new(AllowAllPolicy),
        mode,
        materializer,
        redis_timelines,
    ))
}

pub fn parse_feed_source_mode(raw: &str) -> feed_contracts::gateway::FeedSourceMode {
    match raw.trim().to_ascii_lowercase().as_str() {
        "shadow" => feed_contracts::gateway::FeedSourceMode::Shadow,
        "canary" => feed_contracts::gateway::FeedSourceMode::Canary,
        "engine" => feed_contracts::gateway::FeedSourceMode::Engine,
        _ => feed_contracts::gateway::FeedSourceMode::Sql,
    }
}
