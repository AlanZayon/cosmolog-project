mod common;

use axum::http::StatusCode;
use serde_json::json;

use common::app::{assert_status, json, setup_app};
use common::fixtures::{seed_story, seed_universe, seed_user};

fn profile_sub_path(username: &str) -> String {
    format!("/profiles/{username}/notification-subscription")
}

fn universe_sub_path(universe_id: uuid::Uuid) -> String {
    format!("/universes/{universe_id}/notification-subscription")
}

#[tokio::test]
async fn notification_stream_requires_auth() {
    let Some(app) = setup_app().await else { return };
    let response = app.get("/notifications/stream", None).await;
    assert_status(&response, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn subscribe_profile_success() {
    let Some(app) = setup_app().await else { return };
    let author = seed_user(&app.pool, "notif_author").await;
    let subscriber = seed_user(&app.pool, "notif_subscriber").await;
    seed_story(
        &app.pool,
        author.user_id,
        "First",
        "short_story",
        None,
        None,
    )
    .await;

    let token = app.register_user(&subscriber);
    let response = app
        .post_json(
            &profile_sub_path(&author.profile.username),
            Some(&token),
            json!({}),
        )
        .await;
    assert_status(&response, StatusCode::OK);

    let body = json(response).await;
    assert_eq!(body["subscribed"], true);
    assert_eq!(body["active"], true);
    assert_eq!(body["scope"], "profile");
    assert_eq!(body["unconsumed_count"], 0);
}

#[tokio::test]
async fn subscribe_universe_success() {
    let Some(app) = setup_app().await else { return };
    let author = seed_user(&app.pool, "uni_notif_author").await;
    let subscriber = seed_user(&app.pool, "uni_notif_sub").await;
    let universe = seed_universe(&app.pool, author.user_id, "Notify Uni").await;
    seed_story(
        &app.pool,
        author.user_id,
        "Uni Story",
        "short_story",
        Some(universe.id),
        None,
    )
    .await;

    let token = app.register_user(&subscriber);
    let response = app
        .post_json(&universe_sub_path(universe.id), Some(&token), json!({}))
        .await;
    assert_status(&response, StatusCode::OK);

    let body = json(response).await;
    assert_eq!(body["subscribed"], true);
    assert_eq!(body["active"], true);
    assert_eq!(body["scope"], "universe");
    assert_eq!(body["universe_id"], universe.id.to_string());
}

#[tokio::test]
async fn subscribe_own_profile_forbidden() {
    let Some(app) = setup_app().await else { return };
    let author = seed_user(&app.pool, "self_sub_author").await;
    seed_story(&app.pool, author.user_id, "Mine", "short_story", None, None).await;

    let token = app.register_user(&author);
    let response = app
        .post_json(
            &profile_sub_path(&author.profile.username),
            Some(&token),
            json!({}),
        )
        .await;
    assert_status(&response, StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn subscribe_profile_without_stories_forbidden() {
    let Some(app) = setup_app().await else { return };
    let author = seed_user(&app.pool, "empty_author").await;
    let subscriber = seed_user(&app.pool, "empty_sub").await;

    let token = app.register_user(&subscriber);
    let response = app
        .post_json(
            &profile_sub_path(&author.profile.username),
            Some(&token),
            json!({}),
        )
        .await;
    assert_status(&response, StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn list_active_subscriptions() {
    let Some(app) = setup_app().await else { return };
    let author = seed_user(&app.pool, "list_sub_author").await;
    let subscriber = seed_user(&app.pool, "list_subscriber").await;
    let universe = seed_universe(&app.pool, author.user_id, "List Sub Uni").await;
    seed_story(
        &app.pool,
        author.user_id,
        "Profile Story",
        "short_story",
        None,
        None,
    )
    .await;
    seed_story(
        &app.pool,
        author.user_id,
        "Uni Story",
        "short_story",
        Some(universe.id),
        None,
    )
    .await;

    let token = app.register_user(&subscriber);
    let profile_sub = app
        .post_json(
            &profile_sub_path(&author.profile.username),
            Some(&token),
            json!({}),
        )
        .await;
    assert_status(&profile_sub, StatusCode::OK);

    let universe_sub = app
        .post_json(&universe_sub_path(universe.id), Some(&token), json!({}))
        .await;
    assert_status(&universe_sub, StatusCode::OK);

    let list = app.get("/notifications/subscriptions", Some(&token)).await;
    assert_status(&list, StatusCode::OK);
    let body = json(list).await;
    let items = body["items"].as_array().unwrap();
    assert_eq!(items.len(), 2);

    let scopes: Vec<_> = items
        .iter()
        .map(|item| item["scope"].as_str().unwrap().to_string())
        .collect();
    assert!(scopes.contains(&"profile".to_string()));
    assert!(scopes.contains(&"universe".to_string()));

    let profile_item = items
        .iter()
        .find(|item| item["scope"] == "profile")
        .unwrap();
    assert_eq!(
        profile_item["target_username"],
        author.profile.username
    );

    let universe_item = items
        .iter()
        .find(|item| item["scope"] == "universe")
        .unwrap();
    assert_eq!(universe_item["universe_id"], universe.id.to_string());
    assert_eq!(universe_item["universe_title"], "List Sub Uni");
}

#[tokio::test]
async fn list_subscriptions_requires_auth() {
    let Some(app) = setup_app().await else { return };
    let response = app.get("/notifications/subscriptions", None).await;
    assert_status(&response, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn fanout_on_story_create() {
    let Some(app) = setup_app().await else { return };
    let author = seed_user(&app.pool, "fanout_author").await;
    let subscriber = seed_user(&app.pool, "fanout_sub").await;
    seed_story(
        &app.pool,
        author.user_id,
        "Existing",
        "short_story",
        None,
        None,
    )
    .await;

    let sub_token = app.register_user(&subscriber);
    let sub = app
        .post_json(
            &profile_sub_path(&author.profile.username),
            Some(&sub_token),
            json!({}),
        )
        .await;
    assert_status(&sub, StatusCode::OK);

    let author_token = app.register_user(&author);
    let create = app
        .post_json(
            "/stories",
            Some(&author_token),
            json!({
                "title": "Brand New",
                "type": "short_story",
                "content": "Hello"
            }),
        )
        .await;
    assert_status(&create, StatusCode::OK);
    let story = json(create).await;
    let story_id = story["id"].as_str().unwrap();

    let list = app.get("/notifications", Some(&sub_token)).await;
    assert_status(&list, StatusCode::OK);
    let list_body = json(list).await;
    let items = list_body["items"].as_array().unwrap();
    assert_eq!(items.len(), 1);
    assert_eq!(items[0]["story_id"], story_id);
    assert_eq!(items[0]["kind"], "new_story");
}

#[tokio::test]
async fn profile_subscription_deactivates_at_20() {
    let Some(app) = setup_app().await else { return };
    let author = seed_user(&app.pool, "threshold_author").await;
    let subscriber = seed_user(&app.pool, "threshold_sub").await;
    seed_story(&app.pool, author.user_id, "Seed", "short_story", None, None).await;

    let sub_token = app.register_user(&subscriber);
    let author_token = app.register_user(&author);

    let sub = app
        .post_json(
            &profile_sub_path(&author.profile.username),
            Some(&sub_token),
            json!({}),
        )
        .await;
    assert_status(&sub, StatusCode::OK);

    for i in 0..20 {
        let create = app
            .post_json(
                "/stories",
                Some(&author_token),
                json!({
                    "title": format!("Story {i}"),
                    "type": "short_story",
                    "content": "x"
                }),
            )
            .await;
        assert_status(&create, StatusCode::OK);
    }

    let status = app
        .get(
            &profile_sub_path(&author.profile.username),
            Some(&sub_token),
        )
        .await;
    assert_status(&status, StatusCode::OK);
    let body = json(status).await;
    assert_eq!(body["active"], false);
    assert_eq!(body["disabled_reason"], "unconsumed_threshold");
    assert_eq!(body["unconsumed_count"], 20);
}

#[tokio::test]
async fn universe_subscription_deactivates_at_10() {
    let Some(app) = setup_app().await else { return };
    let author = seed_user(&app.pool, "uni_thresh_author").await;
    let subscriber = seed_user(&app.pool, "uni_thresh_sub").await;
    let universe = seed_universe(&app.pool, author.user_id, "Thresh Uni").await;
    seed_story(
        &app.pool,
        author.user_id,
        "First Uni",
        "short_story",
        Some(universe.id),
        None,
    )
    .await;

    let sub_token = app.register_user(&subscriber);
    let author_token = app.register_user(&author);

    let sub = app
        .post_json(&universe_sub_path(universe.id), Some(&sub_token), json!({}))
        .await;
    assert_status(&sub, StatusCode::OK);

    for i in 0..10 {
        let create = app
            .post_json(
                "/stories",
                Some(&author_token),
                json!({
                    "title": format!("Uni Story {i}"),
                    "type": "short_story",
                    "universe_id": universe.id.to_string(),
                    "content": "x"
                }),
            )
            .await;
        assert_status(&create, StatusCode::OK);
    }

    let status = app
        .get(&universe_sub_path(universe.id), Some(&sub_token))
        .await;
    assert_status(&status, StatusCode::OK);
    let body = json(status).await;
    assert_eq!(body["active"], false);
    assert_eq!(body["disabled_reason"], "unconsumed_threshold");
    assert_eq!(body["unconsumed_count"], 10);
}

#[tokio::test]
async fn consume_resets_unconsumed_count() {
    let Some(app) = setup_app().await else { return };
    let author = seed_user(&app.pool, "consume_author").await;
    let subscriber = seed_user(&app.pool, "consume_sub").await;
    seed_story(
        &app.pool,
        author.user_id,
        "Existing",
        "short_story",
        None,
        None,
    )
    .await;

    let sub_token = app.register_user(&subscriber);
    let author_token = app.register_user(&author);

    let sub = app
        .post_json(
            &profile_sub_path(&author.profile.username),
            Some(&sub_token),
            json!({}),
        )
        .await;
    assert_status(&sub, StatusCode::OK);

    for i in 0..3 {
        let create = app
            .post_json(
                "/stories",
                Some(&author_token),
                json!({
                    "title": format!("N {i}"),
                    "type": "short_story",
                    "content": "x"
                }),
            )
            .await;
        assert_status(&create, StatusCode::OK);
    }

    let status_before = app
        .get(
            &profile_sub_path(&author.profile.username),
            Some(&sub_token),
        )
        .await;
    let before = json(status_before).await;
    assert_eq!(before["unconsumed_count"], 3);

    let list = app.get("/notifications", Some(&sub_token)).await;
    let list_body = json(list).await;
    let notification_id = list_body["items"][0]["id"].as_str().unwrap().to_string();

    let consume = app
        .post_json(
            &format!("/notifications/{notification_id}/consume"),
            Some(&sub_token),
            json!({}),
        )
        .await;
    assert_status(&consume, StatusCode::OK);
    let consumed = json(consume).await;
    assert!(consumed["read_at"].is_string());
    assert!(consumed["clicked_at"].is_string());
    assert_eq!(consumed["subscription_unconsumed_count"], 0);

    let status_after = app
        .get(
            &profile_sub_path(&author.profile.username),
            Some(&sub_token),
        )
        .await;
    let after = json(status_after).await;
    assert_eq!(after["unconsumed_count"], 0);
    assert!(after["last_consumed_at"].is_string());

    let unread = app
        .get("/notifications/unread-count", Some(&sub_token))
        .await;
    let unread_body = json(unread).await;
    assert_eq!(unread_body["count"], 2);
}
