mod common;

use axum::http::StatusCode;
use serde_json::json;

use common::app::{assert_status, json, setup_app};
use common::fixtures::{seed_story, seed_user};

#[tokio::test]
async fn library_collection_requires_auth() {
    let Some(app) = setup_app().await else { return };

    let response = app.get("/library/collections", None).await;
    assert_status(&response, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn user_cannot_access_other_users_collection_stories() {
    let Some(app) = setup_app().await else { return };
    let owner = seed_user(&app.pool, "api_lib_owner").await;
    let intruder = seed_user(&app.pool, "api_lib_intruder").await;
    let author = seed_user(&app.pool, "api_lib_author").await;
    let story = seed_story(
        &app.pool,
        author.user_id,
        "API Story",
        "short_story",
        None,
        None,
    )
    .await;

    let owner_token = app.register_user(&owner);
    let intruder_token = app.register_user(&intruder);

    let create_resp = app
        .post_json(
            "/library/collections",
            Some(&owner_token),
            json!({ "name": "Mine" }),
        )
        .await;
    assert_status(&create_resp, StatusCode::OK);
    let create_body = json(create_resp).await;
    let collection_id = create_body["id"].as_str().unwrap().to_string();

    let add_resp = app
        .post_json(
            &format!("/library/collections/{collection_id}/stories/{}", story.id),
            Some(&owner_token),
            json!({}),
        )
        .await;
    assert_status(&add_resp, StatusCode::NO_CONTENT);

    let response = app
        .get(
            &format!("/library/collections/{collection_id}/stories"),
            Some(&intruder_token),
        )
        .await;
    assert_status(&response, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn liked_stories_returns_liked_only() {
    let Some(app) = setup_app().await else { return };
    let author = seed_user(&app.pool, "api_like_author").await;
    let fan = seed_user(&app.pool, "api_like_fan").await;
    let liked_story = seed_story(
        &app.pool,
        author.user_id,
        "Liked One",
        "short_story",
        None,
        None,
    )
    .await;
    let _other = seed_story(
        &app.pool,
        author.user_id,
        "Not Liked",
        "short_story",
        None,
        None,
    )
    .await;

    let fan_token = app.register_user(&fan);

    let like_resp = app
        .post_json(
            &format!("/stories/{}/like", liked_story.id),
            Some(&fan_token),
            json!({}),
        )
        .await;
    assert_status(&like_resp, StatusCode::OK);

    let response = app.get("/library/liked-stories", Some(&fan_token)).await;
    assert_status(&response, StatusCode::OK);
    let body = json(response).await;
    let arr = body.as_array().unwrap();
    assert_eq!(arr.len(), 1);
    assert_eq!(arr[0]["id"].as_str().unwrap(), liked_story.id.to_string());
    assert!(arr[0]["liked_at"].is_string());
}

#[tokio::test]
async fn public_collection_readable_and_saveable_via_api() {
    let Some(app) = setup_app().await else { return };
    let owner = seed_user(&app.pool, "api_pub_owner").await;
    let fan = seed_user(&app.pool, "api_pub_fan").await;
    let owner_token = app.register_user(&owner);
    let fan_token = app.register_user(&fan);

    let create_resp = app
        .post_json(
            "/library/collections",
            Some(&owner_token),
            json!({ "name": "Open List", "visibility": "public" }),
        )
        .await;
    assert_status(&create_resp, StatusCode::OK);
    let collection_id = json(create_resp).await["id"].as_str().unwrap().to_string();

    let read_resp = app
        .get(
            &format!("/library/collections/{collection_id}/stories"),
            Some(&fan_token),
        )
        .await;
    assert_status(&read_resp, StatusCode::OK);

    let save_resp = app
        .post_json(
            &format!("/library/collections/{collection_id}/save"),
            Some(&fan_token),
            json!({}),
        )
        .await;
    assert_status(&save_resp, StatusCode::NO_CONTENT);

    let list_resp = app.get("/library/collections", Some(&fan_token)).await;
    assert_status(&list_resp, StatusCode::OK);
    let list_body = json(list_resp).await;
    let saved = list_body
        .as_array()
        .unwrap()
        .iter()
        .find(|c| c["ownership"].as_str() == Some("saved"))
        .expect("saved collection on shelf");
    assert_eq!(saved["id"].as_str().unwrap(), collection_id);

    let search_resp = app
        .get("/library/collections/search?q=Open", Some(&fan_token))
        .await;
    assert_status(&search_resp, StatusCode::OK);
    let search_body = json(search_resp).await;
    assert_eq!(search_body.as_array().unwrap().len(), 1);
    assert_eq!(search_body[0]["is_saved_by_me"].as_bool(), Some(true));
}

#[tokio::test]
async fn library_status_endpoint() {
    let Some(app) = setup_app().await else { return };
    let owner = seed_user(&app.pool, "api_status_owner").await;
    let author = seed_user(&app.pool, "api_status_author").await;
    let story = seed_story(
        &app.pool,
        author.user_id,
        "Status Story",
        "short_story",
        None,
        None,
    )
    .await;
    let token = app.register_user(&owner);

    let create_resp = app
        .post_json(
            "/library/collections",
            Some(&token),
            json!({ "name": "Shelf A" }),
        )
        .await;
    assert_status(&create_resp, StatusCode::OK);
    let create_body = json(create_resp).await;
    let collection_id = create_body["id"].as_str().unwrap().to_string();

    let like_resp = app
        .post_json(
            &format!("/stories/{}/like", story.id),
            Some(&token),
            json!({}),
        )
        .await;
    assert_status(&like_resp, StatusCode::OK);

    let add_resp = app
        .post_json(
            &format!("/library/collections/{collection_id}/stories/{}", story.id),
            Some(&token),
            json!({}),
        )
        .await;
    assert_status(&add_resp, StatusCode::NO_CONTENT);

    let response = app
        .get(
            &format!("/stories/{}/library-status", story.id),
            Some(&token),
        )
        .await;
    assert_status(&response, StatusCode::OK);
    let body = json(response).await;
    assert_eq!(body["liked"].as_bool(), Some(true));
    let collections = body["collections"].as_array().unwrap();
    assert_eq!(collections.len(), 1);
    assert_eq!(collections[0]["contains_story"].as_bool(), Some(true));
}
