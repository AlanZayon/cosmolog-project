mod common;

use axum::http::StatusCode;
use serde_json::json;

use common::app::{assert_status, json, setup_app};
use common::fixtures::{seed_story, seed_user};

#[tokio::test]
async fn activity_notification_stream_requires_auth() {
    let Some(app) = setup_app().await else { return };
    let response = app.get("/activity-notifications/stream", None).await;
    assert_status(&response, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn comment_mention_creates_activity_notification() {
    let Some(app) = setup_app().await else { return };
    let author = seed_user(&app.pool, "mention_author").await;
    let mentioned = seed_user(&app.pool, "mention_target").await;
    let commenter = seed_user(&app.pool, "mention_commenter").await;
    let story = seed_story(
        &app.pool,
        author.user_id,
        "Mention Story",
        "short_story",
        None,
        None,
    )
    .await;

    let token = app.register_user(&commenter);
    let response = app
        .post_json(
            &format!("/stories/{}/comments", story.id),
            Some(&token),
            json!({ "content": format!("@{} great read", mentioned.profile.username) }),
        )
        .await;
    assert_status(&response, StatusCode::OK);

    let target_token = app.register_user(&mentioned);
    let list = app
        .get("/activity-notifications?limit=10", Some(&target_token))
        .await;
    assert_status(&list, StatusCode::OK);
    let body = json(list).await;
    let items = body["items"].as_array().unwrap();
    assert_eq!(items.len(), 1);
    assert_eq!(items[0]["kind"], "comment_mention");
    assert_eq!(items[0]["read_at"], serde_json::Value::Null);
}

#[tokio::test]
async fn comment_mention_is_case_insensitive() {
    let Some(app) = setup_app().await else { return };
    let author = seed_user(&app.pool, "ci_author").await;
    let mentioned = seed_user(&app.pool, "CiTarget").await;
    let commenter = seed_user(&app.pool, "ci_commenter").await;
    let story = seed_story(
        &app.pool,
        author.user_id,
        "CI Story",
        "short_story",
        None,
        None,
    )
    .await;

    let token = app.register_user(&commenter);
    let mention = mentioned.profile.username.to_lowercase();
    let response = app
        .post_json(
            &format!("/stories/{}/comments", story.id),
            Some(&token),
            json!({ "content": format!("@{mention} thanks!") }),
        )
        .await;
    assert_status(&response, StatusCode::OK);

    let target_token = app.register_user(&mentioned);
    let list = app
        .get("/activity-notifications?limit=10", Some(&target_token))
        .await;
    let body = json(list).await;
    assert_eq!(body["items"].as_array().unwrap().len(), 1);
}

#[tokio::test]
async fn story_comment_notifies_author() {
    let Some(app) = setup_app().await else { return };
    let author = seed_user(&app.pool, "story_comment_author").await;
    let commenter = seed_user(&app.pool, "story_comment_fan").await;
    let story = seed_story(
        &app.pool,
        author.user_id,
        "Notify Author Story",
        "short_story",
        None,
        None,
    )
    .await;

    let token = app.register_user(&commenter);
    let response = app
        .post_json(
            &format!("/stories/{}/comments", story.id),
            Some(&token),
            json!({ "content": "Nice story!" }),
        )
        .await;
    assert_status(&response, StatusCode::OK);

    let author_token = app.register_user(&author);
    let list = app
        .get("/activity-notifications?limit=10", Some(&author_token))
        .await;
    let body = json(list).await;
    let items = body["items"].as_array().unwrap();
    assert_eq!(items.len(), 1);
    assert_eq!(items[0]["kind"], "story_comment");
}

#[tokio::test]
async fn comment_like_notifies_author() {
    let Some(app) = setup_app().await else { return };
    let author = seed_user(&app.pool, "like_comment_author").await;
    let liker = seed_user(&app.pool, "like_comment_liker").await;
    let story = seed_story(
        &app.pool,
        author.user_id,
        "Like Comment Story",
        "short_story",
        None,
        None,
    )
    .await;

    let author_token = app.register_user(&author);
    let comment = app
        .post_json(
            &format!("/stories/{}/comments", story.id),
            Some(&author_token),
            json!({ "content": "My take" }),
        )
        .await;
    assert_status(&comment, StatusCode::OK);
    let comment_body = json(comment).await;
    let comment_id = comment_body["id"].as_str().unwrap();

    let liker_token = app.register_user(&liker);
    let like = app
        .post_json(
            &format!("/stories/{}/comments/{}/like", story.id, comment_id),
            Some(&liker_token),
            json!({}),
        )
        .await;
    assert_status(&like, StatusCode::OK);

    let list = app
        .get("/activity-notifications?limit=10", Some(&author_token))
        .await;
    let body = json(list).await;
    let items = body["items"].as_array().unwrap();
    assert_eq!(items.len(), 1);
    assert_eq!(items[0]["kind"], "comment_liked");
}

#[tokio::test]
async fn comment_reply_notifies_parent_author() {
    let Some(app) = setup_app().await else { return };
    let author = seed_user(&app.pool, "reply_story_author").await;
    let commenter = seed_user(&app.pool, "reply_commenter").await;
    let replier = seed_user(&app.pool, "reply_replier").await;
    let story = seed_story(
        &app.pool,
        author.user_id,
        "Reply Story",
        "short_story",
        None,
        None,
    )
    .await;

    let commenter_token = app.register_user(&commenter);
    let comment = app
        .post_json(
            &format!("/stories/{}/comments", story.id),
            Some(&commenter_token),
            json!({ "content": "First comment" }),
        )
        .await;
    assert_status(&comment, StatusCode::OK);
    let comment_id = json(comment).await["id"].as_str().unwrap().to_string();

    let replier_token = app.register_user(&replier);
    let reply = app
        .post_json(
            &format!("/stories/{}/comments", story.id),
            Some(&replier_token),
            json!({
                "content": format!("@{} thanks", commenter.profile.username),
                "parent_id": comment_id
            }),
        )
        .await;
    assert_status(&reply, StatusCode::OK);

    let commenter_list = app
        .get(
            "/activity-notifications?limit=10",
            Some(&commenter_token),
        )
        .await;
    let commenter_body = json(commenter_list).await;
    let items = commenter_body["items"].as_array().unwrap();
    assert!(
        items.iter().any(|i| i["kind"] == "comment_reply"),
        "expected comment_reply for parent author"
    );

    let author_token = app.register_user(&author);
    let author_list = app
        .get("/activity-notifications?limit=10", Some(&author_token))
        .await;
    let author_body = json(author_list).await;
    let author_items = author_body["items"].as_array().unwrap();
    assert!(
        author_items.iter().any(|i| i["kind"] == "story_comment"),
        "story author still gets story_comment"
    );
}

#[tokio::test]
async fn comment_reply_notifies_story_owner_on_own_comment() {
    let Some(app) = setup_app().await else { return };
    let author = seed_user(&app.pool, "owner_reply_author").await;
    let replier = seed_user(&app.pool, "owner_reply_replier").await;
    let story = seed_story(
        &app.pool,
        author.user_id,
        "Owner Reply Story",
        "short_story",
        None,
        None,
    )
    .await;

    let author_token = app.register_user(&author);
    let comment = app
        .post_json(
            &format!("/stories/{}/comments", story.id),
            Some(&author_token),
            json!({ "content": "Owner take" }),
        )
        .await;
    assert_status(&comment, StatusCode::OK);
    let comment_id = json(comment).await["id"].as_str().unwrap().to_string();

    let replier_token = app.register_user(&replier);
    let reply = app
        .post_json(
            &format!("/stories/{}/comments", story.id),
            Some(&replier_token),
            json!({
                "content": format!("@{} agree", author.profile.username),
                "parent_id": comment_id
            }),
        )
        .await;
    assert_status(&reply, StatusCode::OK);

    let owner_list = app
        .get("/activity-notifications?limit=10", Some(&author_token))
        .await;
    let owner_body = json(owner_list).await;
    let kinds: Vec<_> = owner_body["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|i| i["kind"].as_str().unwrap())
        .collect();
    assert!(
        kinds.contains(&"comment_reply"),
        "owner should get comment_reply when their comment is answered: {kinds:?}"
    );
    assert!(
        !kinds.contains(&"story_comment"),
        "owner should not get generic story_comment when already got comment_reply: {kinds:?}"
    );
}
