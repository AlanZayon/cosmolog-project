mod common;

use axum::http::StatusCode;
use serde_json::json;

use common::app::{assert_status, json, setup_app};
use common::fixtures::{seed_universe, seed_user};

#[tokio::test]
async fn create_universe_requires_auth() {
    let Some(app) = setup_app().await else { return };

    let response = app
        .post_json("/universes", None, json!({ "title": "No Auth" }))
        .await;
    assert_status(&response, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn create_and_list_own_universes() {
    let Some(app) = setup_app().await else { return };
    let owner = seed_user(&app.pool, "universe_owner").await;
    let token = app.register_user(&owner);

    let create = app
        .post_json(
            "/universes",
            Some(&token),
            json!({ "title": "My Universe", "description": "A place" }),
        )
        .await;
    assert_status(&create, StatusCode::OK);
    let created = json(create).await;
    assert_eq!(created["title"], "My Universe");
    assert_eq!(created["owner_id"], owner.user_id.to_string());

    let list = app.get("/universes/me", Some(&token)).await;
    assert_status(&list, StatusCode::OK);
    let universes = json(list).await;
    assert_eq!(universes.as_array().unwrap().len(), 1);
}

#[tokio::test]
async fn get_universe_by_id_is_public() {
    let Some(app) = setup_app().await else { return };
    let owner = seed_user(&app.pool, "public_uni_owner").await;
    let universe = seed_universe(&app.pool, owner.user_id, "Public View").await;

    let response = app.get(&format!("/universes/{}", universe.id), None).await;
    assert_status(&response, StatusCode::OK);

    let body = json(response).await;
    assert_eq!(body["title"], "Public View");
}

#[tokio::test]
async fn patch_universe_requires_owner() {
    let Some(app) = setup_app().await else { return };
    let owner = seed_user(&app.pool, "uni_owner").await;
    let intruder = seed_user(&app.pool, "uni_intruder").await;
    let universe = seed_universe(&app.pool, owner.user_id, "Owned").await;
    let owner_token = app.register_user(&owner);
    let intruder_token = app.register_user(&intruder);

    let ok = app
        .patch_json(
            &format!("/universes/{}", universe.id),
            Some(&owner_token),
            json!({ "title": "Renamed" }),
        )
        .await;
    assert_status(&ok, StatusCode::OK);

    let denied = app
        .patch_json(
            &format!("/universes/{}", universe.id),
            Some(&intruder_token),
            json!({ "title": "Stolen" }),
        )
        .await;
    assert_status(&denied, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn follow_universe_toggle() {
    let Some(app) = setup_app().await else { return };
    let owner = seed_user(&app.pool, "follow_uni_owner").await;
    let follower = seed_user(&app.pool, "follower").await;
    let universe = seed_universe(&app.pool, owner.user_id, "Follow Target").await;
    let follower_token = app.register_user(&follower);

    let status0 = app
        .get(
            &format!("/universes/{}/follow", universe.id),
            Some(&follower_token),
        )
        .await;
    assert_status(&status0, StatusCode::OK);
    assert_eq!(json(status0).await["following"], false);

    let follow = app
        .post_json(
            &format!("/universes/{}/follow", universe.id),
            Some(&follower_token),
            json!({}),
        )
        .await;
    assert_status(&follow, StatusCode::OK);

    let status1 = app
        .get(
            &format!("/universes/{}/follow", universe.id),
            Some(&follower_token),
        )
        .await;
    assert_eq!(json(status1).await["following"], true);

    let unfollow = app
        .delete(
            &format!("/universes/{}/follow", universe.id),
            Some(&follower_token),
        )
        .await;
    assert_status(&unfollow, StatusCode::OK);
}

#[tokio::test]
async fn create_universe_validates_empty_title() {
    let Some(app) = setup_app().await else { return };
    let user = seed_user(&app.pool, "bad_uni").await;
    let token = app.register_user(&user);

    let response = app
        .post_json("/universes", Some(&token), json!({ "title": "   " }))
        .await;
    assert_status(&response, StatusCode::BAD_REQUEST);
}
