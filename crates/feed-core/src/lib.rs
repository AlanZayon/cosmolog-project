//! Feed Platform shared runtime (Phase E).

pub mod candidates;
pub mod hydrate;
pub mod idempotency;
pub mod outbox;
pub mod rabbit;
pub mod ranking;
pub mod rebuild;
pub mod redis_fs;
pub mod redis_timeline;
pub mod topology;

pub use candidates::{FollowingCandidateSource, PopularityCandidateSource, RecentCandidateSource};
pub use hydrate::{hydrate_feed_items, hydrate_story_payloads};
pub use idempotency::claim_event;
pub use outbox::drain_unpublished;
pub use rabbit::{publish_envelope, RabbitMqEventBus};
pub use ranking::{rank_candidates, sticky_arm, ExperimentAssignment, RankingPipeline, ScoredItem};
pub use rebuild::{list_universe_followers, rebuild_user_timeline, RebuildDeps};
pub use redis_fs::RedisFeatureStore;
pub use redis_timeline::RedisTimelineStore;
pub use topology::{
    connect_with_retry, declare_topology, COMMANDS_EXCHANGE, FEATURES_QUEUE, FEED_EXCHANGE,
    RANK_QUEUE,
};
