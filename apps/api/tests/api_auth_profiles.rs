mod common;

use axum::http::StatusCode;
use serde_json::json;

use common::app::{assert_status, json, setup_app};
use common::fixtures::seed_user;

#[tokio::test]
async fn auth_me_requires_bearer_token() {
    let Some(app) = setup_app().await else { return };

    let response = app.get("/auth/me", None).await;
    assert_status(&response, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn auth_me_returns_claims_for_valid_token() {
    let Some(app) = setup_app().await else { return };
    let user = seed_user(&app.pool, "auth_me_user").await;
    let token = app.register_user(&user);

    let response = app.get("/auth/me", Some(&token)).await;
    assert_status(&response, StatusCode::OK);

    let body = json(response).await;
    assert_eq!(body["user_id"], user.user_id.to_string());
    assert_eq!(body["role"], "authenticated");
}

#[tokio::test]
async fn profiles_me_requires_auth() {
    let Some(app) = setup_app().await else { return };

    let response = app.get("/profiles/me", None).await;
    assert_status(&response, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn profiles_me_returns_own_profile() {
    let Some(app) = setup_app().await else { return };
    let user = seed_user(&app.pool, "profile_owner").await;
    let token = app.register_user(&user);

    let response = app.get("/profiles/me", Some(&token)).await;
    assert_status(&response, StatusCode::OK);

    let body = json(response).await;
    assert_eq!(body["username"], "profile_owner");
    assert_eq!(body["user_id"], user.user_id.to_string());
}

#[tokio::test]
async fn profiles_me_patch_updates_profile() {
    let Some(app) = setup_app().await else { return };
    let user = seed_user(&app.pool, "patch_me").await;
    let token = app.register_user(&user);

    let response = app
        .patch_json(
            "/profiles/me",
            Some(&token),
            json!({ "username": "Patched", "bio": "New bio" }),
        )
        .await;
    assert_status(&response, StatusCode::OK);

    let body = json(response).await;
    assert_eq!(body["username"], "Patched");
    assert_eq!(body["bio"], "New bio");
}

#[tokio::test]
async fn profiles_by_username_is_public() {
    let Some(app) = setup_app().await else { return };
    seed_user(&app.pool, "public_user").await;

    let response = app.get("/profiles/public_user", None).await;
    assert_status(&response, StatusCode::OK);

    let body = json(response).await;
    assert_eq!(body["username"], "public_user");
}

#[tokio::test]
async fn profiles_by_username_returns_404_when_missing() {
    let Some(app) = setup_app().await else { return };

    let response = app.get("/profiles/no_such_user", None).await;
    assert_status(&response, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn profiles_me_patch_validates_empty_username() {
    let Some(app) = setup_app().await else { return };
    let user = seed_user(&app.pool, "bad_patch").await;
    let token = app.register_user(&user);

    let response = app
        .patch_json("/profiles/me", Some(&token), json!({ "username": "  " }))
        .await;
    assert_status(&response, StatusCode::BAD_REQUEST);
}
