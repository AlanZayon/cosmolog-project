//! Integration-style unit test: event → feature → rank → materialize (no Postgres).

use feed_contracts::candidates::{Candidate, CandidateMixer, CandidateSet, ItemType};
use feed_contracts::features::FeatureValue;
use uuid::Uuid;

use cosmolog_api::feed::{
    rank_candidates, ExperimentAssignment, MemoryFeatureStore, RankingPipeline,
    TimelineMaterializer,
};

#[test]
fn event_feature_rank_materialize_path() {
    let store = MemoryFeatureStore::new();
    let story_id = Uuid::new_v4();
    let user_id = Uuid::new_v4();
    store.set_feature(
        "story",
        story_id,
        "story.likes_count",
        FeatureValue::Float(12.0),
    );

    let set = CandidateSet {
        items: vec![Candidate {
            id: story_id,
            item_type: ItemType::Story,
            reasons: vec!["recent".into(), "popular".into()],
            rough_score: 800_000.0,
        }],
    };
    let mixer = CandidateMixer { max_total: 10 };
    let merged = mixer.merge(vec![feed_contracts::candidates::CandidateBatch {
        source: "test".into(),
        items: set.items.clone(),
    }]);
    assert_eq!(merged.items.len(), 1);

    let features = store.mget("story", &[story_id]);
    let pipeline = RankingPipeline::from_weights(serde_json::json!({
        "recency": 1.0,
        "popularity": 0.8,
        "following": 2.0
    }));
    let ranked = rank_candidates(
        &pipeline,
        merged,
        &features,
        &ExperimentAssignment {
            experiment_id: "feed_v1".into(),
            arm: "control".into(),
            weights: serde_json::json!({}),
        },
    );
    assert_eq!(ranked.len(), 1);

    let mat = TimelineMaterializer::new();
    mat.put_payload(
        story_id,
        serde_json::json!({ "id": story_id, "title": "t" }),
    );
    mat.write_timeline(user_id, &ranked);
    let tl = mat.read_timeline(user_id, 10);
    assert_eq!(tl[0].0, story_id);
}
