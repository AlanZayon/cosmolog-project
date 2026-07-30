//! Cosmolog Feed Platform contracts (RFC v3).
//!
//! Brokers (NATS / RabbitMQ / later Redpanda) implement [`bus::EventBus`].
//! Domain code depends only on these types — never on a concrete broker SDK.

pub mod ann;
pub mod bus;
pub mod candidates;
pub mod events;
pub mod features;
pub mod gateway;
pub mod ids;
pub mod policy;
pub mod registry;

pub use ann::{NeighborHit, NoopVectorSearch, VectorSearch};
pub use bus::{EventBus, EventPublishError, MemoryEventBus};
pub use candidates::{
    Candidate, CandidateBatch, CandidateMixer, CandidateSet, CandidateSource, ItemType,
    RetrievalContext, SourceId,
};
pub use events::{
    DomainEvent, EventEnvelope, EventType, StoryCreatedPayload, StoryLikedPayload,
    UniverseFollowedPayload,
};
pub use features::{FeatureName, FeatureValue, FeatureVector};
pub use gateway::{FeedGateway, FeedQuery, FeedResponseItem, FeedSourceMode};
pub use ids::{ItemId, ViewerId};
pub use policy::{AllowAllPolicy, FilterDecision, PolicyClient, PolicyDecision};
pub use registry::{FeatureRegistry, FeatureRegistryEntry, FeatureValueType};
