//! Outbox + feed gateway phase A tests.

mod common;

use axum::http::StatusCode;
use feed_contracts::bus::MemoryEventBus;
use serde_json::json;
use uuid::Uuid;

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
async fn prune_event_outbox_drops_rows_older_than_14_days() {
    let Some(app) = setup_app().await else {
        return;
    };

    let stale_id = Uuid::new_v4();
    let recent_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO event_outbox (event_id, event_type, payload, schema_version, producer, created_at)
        VALUES
          ($1, 'story.created', '{}'::jsonb, 1, 'api', now() - INTERVAL '15 days'),
          ($2, 'story.created', '{}'::jsonb, 1, 'api', now() - INTERVAL '1 day')
        "#,
    )
    .bind(stale_id)
    .bind(recent_id)
    .execute(&app.pool)
    .await
    .expect("insert outbox fixtures");

    cosmolog_api::domain::outbox::prune_event_outbox(&app.pool).await;

    let remaining: Vec<Uuid> =
        sqlx::query_scalar("SELECT event_id FROM event_outbox ORDER BY created_at")
            .fetch_all(&app.pool)
            .await
            .expect("list remaining outbox rows");
    assert_eq!(remaining, vec![recent_id]);
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
