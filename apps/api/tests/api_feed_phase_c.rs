//! Phase C: gateway modes + materializer serve path.

mod common;

use axum::http::StatusCode;
use common::app::{assert_status, json, setup_app};
use common::fixtures::{seed_story, seed_user};
use cosmolog_api::feed::SqlFeedGateway;
use cosmolog_api::feed::{
    sticky_arm, ExperimentAssignment, RankingPipeline, ScoredItem, TimelineMaterializer,
};
use feed_contracts::candidates::{Candidate, ItemType};
use feed_contracts::gateway::{FeedGateway, FeedQuery, FeedSourceMode};
use feed_contracts::ids::ViewerId;
use feed_contracts::policy::AllowAllPolicy;
use std::sync::Arc;
use uuid::Uuid;

#[tokio::test]
async fn sql_mode_still_serves_get_feed() {
    let Some(app) = setup_app().await else {
        return;
    };
    let author = seed_user(&app.pool, "c_sql_author").await;
    seed_story(
        &app.pool,
        author.user_id,
        "C SQL Story",
        "short_story",
        None,
        None,
    )
    .await;
    let response = app.get("/feed?limit=5", None).await;
    assert_status(&response, StatusCode::OK);
    let body = json(response).await;
    assert!(body.as_array().is_some());
}

#[tokio::test]
async fn canary_serves_materialized_timeline_when_present() {
    let Some(app) = setup_app().await else {
        return;
    };
    let user_id = seed_user(&app.pool, "c_canary_user").await.user_id;
    let story_id = Uuid::new_v4();
    let mat = TimelineMaterializer::new();
    mat.put_payload(
        story_id,
        serde_json::json!({ "id": story_id, "title": "Materialized" }),
    );
    let scored = vec![ScoredItem {
        candidate: Candidate {
            id: story_id,
            item_type: ItemType::Story,
            reasons: vec!["recent".into()],
            rough_score: 1.0,
        },
        score: 42.0,
        signals: vec![],
    }];
    mat.write_timeline(user_id, &scored);

    let gw = SqlFeedGateway::new(
        app.pool.clone(),
        Arc::new(AllowAllPolicy),
        FeedSourceMode::Engine,
        mat,
    );
    let items = gw
        .get_home_feed(FeedQuery {
            viewer_id: Some(ViewerId(user_id)),
            limit: 10,
            cursor: None,
        })
        .await
        .expect("feed");
    assert_eq!(items.len(), 1);
    assert_eq!(items[0].id, story_id);
    assert_eq!(items[0].ranking_score, 42.0);
}

#[test]
fn sticky_canary_assignment_stable() {
    let uid = Uuid::new_v4();
    assert_eq!(
        sticky_arm(Some(uid), "feed_canary", &["sql", "engine"]),
        sticky_arm(Some(uid), "feed_canary", &["sql", "engine"])
    );
    let _ = RankingPipeline::from_weights(serde_json::json!({}));
    let _ = ExperimentAssignment {
        experiment_id: "e".into(),
        arm: "control".into(),
        weights: serde_json::json!({}),
    };
}
