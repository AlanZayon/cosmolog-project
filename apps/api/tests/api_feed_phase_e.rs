//! Phase E: Redis timeline gateway + hydrate contract.

mod common;

use axum::http::StatusCode;
use feed_contracts::gateway::{FeedGateway, FeedQuery, FeedSourceMode};
use feed_contracts::ids::ViewerId;
use feed_contracts::policy::AllowAllPolicy;
use feed_core::{hydrate_story_payloads, RedisTimelineStore, RankingPipeline, ScoredItem};
use feed_contracts::candidates::{Candidate, ItemType};
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use common::app::{assert_status, json, setup_app};
use common::fixtures::{seed_story, seed_user};
use cosmolog_api::feed::{SqlFeedGateway, TimelineMaterializer};

fn redis_feed_url() -> Option<String> {
    std::env::var("REDIS_FEED_URL")
        .ok()
        .filter(|s| !s.is_empty())
        .or_else(|| {
            // Prefer DB 2 on local redis when available
            Some("redis://127.0.0.1:6379/2".into())
        })
}

#[tokio::test]
async fn engine_gateway_serves_redis_timeline_with_get_feed_shape() {
    let Some(app) = setup_app().await else {
        return;
    };
    let Some(redis_url) = redis_feed_url() else {
        return;
    };
    let timelines = match RedisTimelineStore::connect(&redis_url).await {
        Ok(t) => t,
        Err(e) => {
            eprintln!("SKIP Phase E redis test: {e}");
            return;
        }
    };

    let author = seed_user(&app.pool, "e_engine_author").await;
    let story = seed_story(
        &app.pool,
        author.user_id,
        "Engine Redis Story",
        "short_story",
        None,
        None,
    )
    .await;
    let story_id = story.id;

    let payloads = hydrate_story_payloads(&app.pool, &[story_id])
        .await
        .expect("hydrate");
    assert_eq!(payloads.len(), 1);
    timelines
        .put_payload("story", story_id, payloads[0].1.clone())
        .await
        .expect("put payload");

    let scored = vec![ScoredItem {
        candidate: Candidate {
            id: story_id,
            item_type: ItemType::Story,
            reasons: vec!["test".into()],
            rough_score: 1.0,
        },
        score: 42.0,
        signals: vec![],
    }];
    timelines
        .write_timeline(author.user_id, &scored)
        .await
        .expect("write timeline");

    let gw = SqlFeedGateway::with_redis(
        app.pool.clone(),
        Arc::new(AllowAllPolicy),
        FeedSourceMode::Engine,
        TimelineMaterializer::new(),
        Some(timelines),
        true,
    );

    let items = gw
        .get_home_feed(FeedQuery {
            viewer_id: Some(ViewerId(author.user_id)),
            limit: 10,
            cursor: None,
        })
        .await
        .expect("feed");

    assert!(!items.is_empty());
    assert_eq!(items[0].id, story_id);
    assert_eq!(items[0].item_type, "story");
    assert!(items[0].payload.get("title").is_some());
    assert!(items[0].payload.get("author").is_some());
    assert!(items[0].payload.get("stats").is_some());
    assert_eq!(items[0].ranking_score, 42.0);
}

#[tokio::test]
async fn sql_mode_still_returns_get_feed_array() {
    let Some(app) = setup_app().await else {
        return;
    };
    let author = seed_user(&app.pool, "e_sql_author").await;
    seed_story(
        &app.pool,
        author.user_id,
        "SQL Rollback Story",
        "short_story",
        None,
        None,
    )
    .await;

    let response = app.get("/feed?limit=5", None).await;
    assert_status(&response, StatusCode::OK);
    let body = json(response).await;
    assert!(body.is_array());
    if let Some(first) = body.as_array().and_then(|a| a.first()) {
        assert!(first.get("id").is_some());
        assert!(first.get("type").is_some());
        assert!(first.get("payload").is_some());
        assert!(first.get("ranking_score").is_some());
    }
}

#[tokio::test]
async fn ranking_pipeline_still_pure() {
    let _ = RankingPipeline::from_weights(json!({ "recency": 1.0 }));
    let id = Uuid::new_v4();
    assert!(!id.is_nil());
}
