//! Feed Platform serving + policy + features + ranking (phased).

mod candidates;
mod feature_store;
mod gateway;
mod graph;
mod materializer;
mod metadata;
mod ranking;
mod registry;
mod sql_gateway;
mod workers;

pub use candidates::{PopularityCandidateSource, RecentCandidateSource};
pub use feature_store::MemoryFeatureStore;
pub use gateway::{build_feed_gateway, parse_feed_source_mode};
pub use graph::set_follow_edge;
pub use materializer::TimelineMaterializer;
pub use metadata::{load_weights, MetadataSnapshot};
pub use ranking::{rank_candidates, sticky_arm, ExperimentAssignment, RankingPipeline, ScoredItem};
pub use registry::load_feature_registry;
pub use sql_gateway::SqlFeedGateway;
pub use workers::FeatureWorkers;
