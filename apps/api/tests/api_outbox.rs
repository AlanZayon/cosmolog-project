//! Outbox + feed gateway phase A tests.

mod common;

use axum::http::StatusCode;
use feed_contracts::bus::MemoryEventBus;
use serde_json::json;

use common::app::{assert_status, json, setup_app};
use common::fixtures::seed_user;

#[tokio::test]
async fn create_story_writes_outbox_and_relay_publishes() {
    let Some(app) = setup_app().await else {
        return;
    };
    let author = seed_user(&app.pool, "outbox_author").await;
    let token = app.register_user(&author);

    let response = app
        .post_json(
            "/stories",
            Some(&token),
            json!({
                "title": "Outbox Story",
                "description": "desc",
                "type": "short_story"
            }),
        )
        .await;
    assert_status(&response, StatusCode::OK);

    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM event_outbox WHERE event_type = 'story.created' AND published_at IS NULL",
    )
    .fetch_one(&app.pool)
    .await
    .unwrap();
    assert!(count >= 1, "expected unpublished story.created outbox row");

    let bus = MemoryEventBus::new();
    let published = cosmolog_api::domain::outbox::drain_unpublished(&app.pool, &bus, 50)
        .await
        .expect("drain");
    assert!(published >= 1);
    assert!(!bus.published().is_empty());
}

#[tokio::test]
async fn feed_still_uses_sql_shape_via_gateway() {
    let Some(app) = setup_app().await else {
        return;
    };
    let author = seed_user(&app.pool, "gw_feed_author").await;
    common::fixtures::seed_story(
        &app.pool,
        author.user_id,
        "Gateway Story",
        "short_story",
        None,
        None,
    )
    .await;

    let response = app.get("/feed?limit=5", None).await;
    assert_status(&response, StatusCode::OK);
    let body = json(response).await;
    assert!(body.is_array());
}
