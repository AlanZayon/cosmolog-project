mod common;

use axum::http::StatusCode;
use serde_json::json;

use common::app::{assert_status, json, setup_app};
use common::fixtures::{seed_story, seed_user};

#[tokio::test]
async fn create_story_requires_auth() {
    let Some(app) = setup_app().await else { return };

    let response = app
        .post_json(
            "/stories",
            None,
            json!({ "title": "T", "type": "short_story" }),
        )
        .await;
    assert_status(&response, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn create_list_and_get_story() {
    let Some(app) = setup_app().await else { return };
    let author = seed_user(&app.pool, "story_author").await;
    let token = app.register_user(&author);

    let create = app
        .post_json(
            "/stories",
            Some(&token),
            json!({
                "title": "HTTP Story",
                "description": "Via API",
                "type": "short_story",
                "content": "Hello world"
            }),
        )
        .await;
    assert_status(&create, StatusCode::OK);
    let story = json(create).await;
    assert_eq!(story["title"], "HTTP Story");
    assert_eq!(story["author_id"], author.user_id.to_string());

    let list = app.get("/stories/me", Some(&token)).await;
    assert_status(&list, StatusCode::OK);
    assert_eq!(json(list).await.as_array().unwrap().len(), 1);

    let story_id = story["id"].as_str().unwrap();
    let get = app.get(&format!("/stories/{story_id}"), None).await;
    assert_status(&get, StatusCode::OK);
    assert_eq!(json(get).await["title"], "HTTP Story");
}

#[tokio::test]
async fn patch_story_requires_author() {
    let Some(app) = setup_app().await else { return };
    let author = seed_user(&app.pool, "story_owner").await;
    let intruder = seed_user(&app.pool, "story_thief").await;
    let story = seed_story(
        &app.pool,
        author.user_id,
        "Protected",
        "short_story",
        None,
        None,
    )
    .await;
    let author_token = app.register_user(&author);
    let intruder_token = app.register_user(&intruder);

    let ok = app
        .patch_json(
            &format!("/stories/{}", story.id),
            Some(&author_token),
            json!({ "title": "Updated" }),
        )
        .await;
    assert_status(&ok, StatusCode::OK);
    assert_eq!(json(ok).await["title"], "Updated");

    let denied = app
        .patch_json(
            &format!("/stories/{}", story.id),
            Some(&intruder_token),
            json!({ "title": "Hacked" }),
        )
        .await;
    assert_status(&denied, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn search_stories_by_title() {
    let Some(app) = setup_app().await else { return };
    let author = seed_user(&app.pool, "search_author").await;
    seed_story(
        &app.pool,
        author.user_id,
        "Unique Nebula Title",
        "chapters",
        None,
        None,
    )
    .await;

    let response = app.get("/stories/search?q=nebula", None).await;
    assert_status(&response, StatusCode::OK);

    let hits = json(response).await;
    let arr = hits.as_array().unwrap();
    assert_eq!(arr.len(), 1);
    assert!(arr[0]["title"].as_str().unwrap().contains("Nebula"));
}

#[tokio::test]
async fn story_like_toggle_via_http() {
    let Some(app) = setup_app().await else { return };
    let author = seed_user(&app.pool, "like_author").await;
    let fan = seed_user(&app.pool, "like_fan").await;
    let story = seed_story(
        &app.pool,
        author.user_id,
        "Likeable",
        "short_story",
        None,
        None,
    )
    .await;
    let fan_token = app.register_user(&fan);
    let path = format!("/stories/{}/like", story.id);

    let status0 = app.get(&path, Some(&fan_token)).await;
    assert_status(&status0, StatusCode::OK);
    assert_eq!(json(status0).await["liked"], false);

    let toggle = app.post_json(&path, Some(&fan_token), json!({})).await;
    assert_status(&toggle, StatusCode::OK);
    assert_eq!(json(toggle).await["liked"], true);

    let toggle2 = app.post_json(&path, Some(&fan_token), json!({})).await;
    assert_eq!(json(toggle2).await["liked"], false);
}

#[tokio::test]
async fn story_comments_create_and_list() {
    let Some(app) = setup_app().await else { return };
    let author = seed_user(&app.pool, "comment_story_author").await;
    let reader = seed_user(&app.pool, "comment_reader").await;
    let story = seed_story(
        &app.pool,
        author.user_id,
        "Discuss",
        "short_story",
        None,
        None,
    )
    .await;
    let reader_token = app.register_user(&reader);
    let base = format!("/stories/{}/comments", story.id);

    let empty = app.get(&base, None).await;
    assert_status(&empty, StatusCode::OK);
    assert!(json(empty).await.as_array().unwrap().is_empty());

    let create = app
        .post_json(&base, Some(&reader_token), json!({ "content": "Nice!" }))
        .await;
    assert_status(&create, StatusCode::OK);
    assert_eq!(json(create).await["content"], "Nice!");

    let list = app.get(&base, None).await;
    assert_eq!(json(list).await.as_array().unwrap().len(), 1);
}

#[tokio::test]
async fn create_story_validates_invalid_type() {
    let Some(app) = setup_app().await else { return };
    let user = seed_user(&app.pool, "bad_story_type").await;
    let token = app.register_user(&user);

    let response = app
        .post_json(
            "/stories",
            Some(&token),
            json!({ "title": "Bad", "type": "novel" }),
        )
        .await;
    assert_status(&response, StatusCode::BAD_REQUEST);
}
