mod common;

use axum::http::StatusCode;
use serde_json::json;

use common::app::{assert_status, json, setup_app};
use common::fixtures::{seed_arc, seed_story, seed_universe, seed_user};

const SUPABASE: &str = "https://test-project.supabase.co";

fn comics_url(path: &str) -> String {
    format!("{SUPABASE}/storage/v1/object/public/comics/{path}")
}

#[tokio::test]
async fn create_story_accepts_own_universe() {
    let Some(app) = setup_app().await else { return };
    let owner = seed_user(&app.pool, "scope_owner").await;
    let universe = seed_universe(&app.pool, owner.user_id, "My Universe").await;
    let token = app.register_user(&owner);

    let response = app
        .post_json(
            "/stories",
            Some(&token),
            json!({
                "title": "In Universe",
                "type": "short_story",
                "universe_id": universe.id
            }),
        )
        .await;
    assert_status(&response, StatusCode::OK);
    assert_eq!(
        json(response).await["universe_id"].as_str().unwrap(),
        universe.id.to_string()
    );
}

#[tokio::test]
async fn create_story_rejects_foreign_arc() {
    let Some(app) = setup_app().await else { return };
    let owner = seed_user(&app.pool, "arc_owner").await;
    let intruder = seed_user(&app.pool, "arc_intruder").await;
    let universe = seed_universe(&app.pool, owner.user_id, "Arc Home").await;
    let arc = seed_arc(&app.pool, universe.id, "Season 1").await;
    let token = app.register_user(&intruder);

    let response = app
        .post_json(
            "/stories",
            Some(&token),
            json!({
                "title": "Sneaky",
                "type": "short_story",
                "universe_id": universe.id,
                "arc_id": arc.id
            }),
        )
        .await;
    assert_status(&response, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn replace_blocks_requires_author() {
    let Some(app) = setup_app().await else { return };
    let author = seed_user(&app.pool, "blocks_author").await;
    let intruder = seed_user(&app.pool, "blocks_thief").await;
    let story = seed_story(
        &app.pool,
        author.user_id,
        "Block Story",
        "chapters",
        None,
        None,
    )
    .await;
    let intruder_token = app.register_user(&intruder);
    let path = format!("/stories/{}/blocks", story.id);

    let denied = app
        .put_json(
            &path,
            Some(&intruder_token),
            json!({
                "blocks": [{ "block_type": "text", "content": "nope" }]
            }),
        )
        .await;
    assert_status(&denied, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn replace_blocks_rejects_untrusted_image_url() {
    let Some(app) = setup_app().await else { return };
    let author = seed_user(&app.pool, "blocks_url_author").await;
    let story = seed_story(
        &app.pool,
        author.user_id,
        "Image Blocks",
        "chapters",
        None,
        None,
    )
    .await;
    let token = app.register_user(&author);
    let path = format!("/stories/{}/blocks", story.id);

    let response = app
        .put_json(
            &path,
            Some(&token),
            json!({
                "blocks": [{
                    "block_type": "image",
                    "content": "javascript:alert(1)"
                }]
            }),
        )
        .await;
    assert_status(&response, StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn replace_blocks_accepts_valid_storage_image_url() {
    let Some(app) = setup_app().await else { return };
    let author = seed_user(&app.pool, "blocks_ok_author").await;
    let story = seed_story(
        &app.pool,
        author.user_id,
        "Valid Image Blocks",
        "chapters",
        None,
        None,
    )
    .await;
    let token = app.register_user(&author);
    let path = format!("/stories/{}/blocks", story.id);
    let image_url = comics_url("user-id/page.png");

    let response = app
        .put_json(
            &path,
            Some(&token),
            json!({
                "blocks": [
                    { "block_type": "text", "content": "Hello" },
                    { "block_type": "image", "content": image_url }
                ]
            }),
        )
        .await;
    assert_status(&response, StatusCode::OK);

    let blocks = json(response).await;
    assert_eq!(blocks.as_array().unwrap().len(), 2);
}
