//! Graph read-model helpers (Phase D seam). Indexes live in Feature Store today.

use uuid::Uuid;

use super::feature_store::MemoryFeatureStore;
use feed_contracts::features::FeatureValue;

/// Mark a follow edge in the FS graph namespace (used by FollowingCandidateSource later).
pub fn set_follow_edge(store: &MemoryFeatureStore, user_id: Uuid, universe_id: Uuid, following: bool) {
    store.set_feature(
        "graph",
        user_id,
        &format!("follows:{universe_id}"),
        FeatureValue::Bool(following),
    );
}
