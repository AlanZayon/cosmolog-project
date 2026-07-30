use std::sync::Arc;

use feed_contracts::gateway::{FeedGateway, FeedSourceMode};
use feed_contracts::policy::AllowAllPolicy;
use sqlx::PgPool;

use super::materializer::TimelineMaterializer;
use super::sql_gateway::SqlFeedGateway;

pub fn build_feed_gateway(
    pool: PgPool,
    mode: FeedSourceMode,
    materializer: TimelineMaterializer,
) -> Arc<dyn FeedGateway> {
    Arc::new(SqlFeedGateway::new(
        pool,
        Arc::new(AllowAllPolicy),
        mode,
        materializer,
    ))
}

pub fn parse_feed_source_mode(raw: &str) -> FeedSourceMode {
    match raw.trim().to_ascii_lowercase().as_str() {
        "shadow" => FeedSourceMode::Shadow,
        "canary" => FeedSourceMode::Canary,
        "engine" => FeedSourceMode::Engine,
        _ => FeedSourceMode::Sql,
    }
}
