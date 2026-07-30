//! Phase D seams: VectorSearch stub + graph FS helper (no Redpanda/ANN prod).

use cosmolog_api::feed::{set_follow_edge, MemoryFeatureStore};
use feed_contracts::ann::{NoopVectorSearch, VectorSearch};
use feed_contracts::features::FeatureValue;
use uuid::Uuid;

#[tokio::test]
async fn noop_vector_search_returns_empty() {
    let ann = NoopVectorSearch;
    let hits = ann.neighbors(Uuid::new_v4(), 10).await;
    assert!(hits.is_empty());
}

#[test]
fn graph_follow_edge_in_feature_store() {
    let store = MemoryFeatureStore::new();
    let user = Uuid::new_v4();
    let universe = Uuid::new_v4();
    set_follow_edge(&store, user, universe, true);
    let key = format!("follows:{universe}");
    match store.get("graph", user).values.get(&key) {
        Some(FeatureValue::Bool(true)) => {}
        other => panic!("expected follow edge true, got {other:?}"),
    }
}
