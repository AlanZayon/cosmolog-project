//! Phase B: feature workers + metadata + candidate sources (needs TEST_DATABASE_URL).

mod common;

use common::app::setup_app;
use common::fixtures::{seed_story, seed_user};
use cosmolog_api::feed::{
    load_weights, FeatureWorkers, MemoryFeatureStore, PopularityCandidateSource,
    RecentCandidateSource,
};
use feed_contracts::candidates::{CandidateMixer, CandidateSource, RetrievalContext};
use feed_contracts::events::EventType;
use serde_json::json;
use uuid::Uuid;

#[tokio::test]
async fn feature_worker_idempotent_and_updates_store() {
    let Some(app) = setup_app().await else {
        return;
    };
    let store = MemoryFeatureStore::new();
    let workers = FeatureWorkers::new(app.pool.clone(), store.clone());
    let story_id = Uuid::new_v4();
    let event_id = Uuid::new_v4();
    let payload = json!({
        "story_id": story_id,
        "author_id": Uuid::new_v4(),
        "liked": true
    });

    let first = workers
        .handle_event(event_id, EventType::StoryLiked.as_str(), &payload)
        .await
        .expect("first");
    assert!(first);
    let second = workers
        .handle_event(event_id, EventType::StoryLiked.as_str(), &payload)
        .await
        .expect("second");
    assert!(!second, "redelivery must be idempotent");

    let likes = store
        .get("story", story_id)
        .get_f64("story.likes_count")
        .unwrap_or(0.0);
    assert!(likes >= 1.0);
}

#[tokio::test]
async fn metadata_weights_loadable() {
    let Some(app) = setup_app().await else {
        return;
    };
    let snap = load_weights(&app.pool).await.expect("weights");
    assert!(snap.version >= 0);
    assert!(
        snap.value.get("recency").is_some()
            || snap.value.get("max_candidates").is_some()
            || snap.value.is_object()
    );
}

#[tokio::test]
async fn two_candidate_sources_and_mixer() {
    let Some(app) = setup_app().await else {
        return;
    };
    let author = seed_user(&app.pool, "cand_author").await;
    seed_story(
        &app.pool,
        author.user_id,
        "Cand Story",
        "short_story",
        None,
        None,
    )
    .await;

    let store = MemoryFeatureStore::new();
    let recent = RecentCandidateSource {
        pool: app.pool.clone(),
    };
    let popular = PopularityCandidateSource {
        store,
        pool: app.pool.clone(),
    };
    let ctx = RetrievalContext {
        viewer_id: None,
        limit_per_source: 10,
        experiment_arms: vec![],
    };
    let b1 = recent.fetch(&ctx).await;
    let b2 = popular.fetch(&ctx).await;
    assert!(!b1.items.is_empty());
    assert!(!b2.items.is_empty());
    let set = CandidateMixer { max_total: 50 }.merge(vec![b1, b2]);
    assert!(!set.items.is_empty());
}
