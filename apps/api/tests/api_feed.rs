mod common;

use axum::http::StatusCode;

use common::app::{assert_status, json, setup_app};
use common::fixtures::{seed_story, seed_user};

#[tokio::test]
async fn feed_returns_ranked_items_anonymously() {
    let Some(app) = setup_app().await else { return };
    let author = seed_user(&app.pool, "feed_author").await;
    seed_story(&app.pool, author.user_id, "Feed Story", "short_story", None, None).await;

    let response = app.get("/feed?limit=10", None).await;
    assert_status(&response, StatusCode::OK);

    let body = json(response).await;
    let items = body.as_array().expect("feed array");
    assert!(!items.is_empty());
    let story = items
        .iter()
        .find(|item| item["type"] == "story")
        .expect("story item");
    assert_eq!(story["payload"]["title"], "Feed Story");
    assert_eq!(story["payload"]["author"]["username"], "feed_author");
}

#[tokio::test]
async fn feed_accepts_authenticated_viewer() {
    let Some(app) = setup_app().await else { return };
    let author = seed_user(&app.pool, "feed_viewer_author").await;
    seed_story(&app.pool, author.user_id, "Viewer Story", "short_story", None, None).await;
    let viewer = seed_user(&app.pool, "feed_viewer").await;
    let token = app.register_user(&viewer);

    let response = app.get("/feed?limit=5", Some(&token)).await;
    assert_status(&response, StatusCode::OK);
    let body = json(response).await;
    assert!(body.as_array().is_some());
}
