use std::sync::Arc;

use axum::extract::FromRequestParts;
use axum::http::{header::AUTHORIZATION, Request};
use cosmolog_api::auth::{AuthUser, MockTokenValidator, OptionalAuth, TokenValidator};
use cosmolog_api::config::Config;
use cosmolog_api::error::AppError;
use cosmolog_api::state::AppState;
use sqlx::postgres::PgPoolOptions;
use uuid::Uuid;

mod common;

fn test_state(jwt: Arc<dyn TokenValidator>, config: &Config) -> AppState {
    let pool = PgPoolOptions::new()
        .connect_lazy("postgres://localhost/unused")
        .expect("lazy pool");
    AppState::new(pool, jwt, config)
}

#[tokio::test]
async fn auth_user_rejects_missing_authorization_header() {
    let jwt = MockTokenValidator::accepting(Uuid::new_v4());
    let config = common::test_config();
    let state = test_state(jwt, &config);
    let (mut parts, _) = Request::builder().uri("/").body(()).unwrap().into_parts();

    let err = AuthUser::from_request_parts(&mut parts, &state)
        .await
        .unwrap_err();
    assert!(matches!(err, AppError::Unauthorized(_)));
}

#[tokio::test]
async fn auth_user_rejects_malformed_bearer() {
    let jwt = MockTokenValidator::accepting(Uuid::new_v4());
    let config = common::test_config();
    let state = test_state(jwt, &config);
    let (mut parts, _) = Request::builder()
        .uri("/")
        .header(AUTHORIZATION, "Token abc")
        .body(())
        .unwrap()
        .into_parts();

    assert!(matches!(
        AuthUser::from_request_parts(&mut parts, &state).await,
        Err(AppError::Unauthorized(_))
    ));
}

#[tokio::test]
async fn auth_user_accepts_valid_bearer() {
    let user_id = Uuid::new_v4();
    let jwt = MockTokenValidator::accepting(user_id);
    let config = common::test_config();
    let state = test_state(jwt, &config);
    let (mut parts, _) = Request::builder()
        .uri("/")
        .header(AUTHORIZATION, "Bearer my-access-token")
        .body(())
        .unwrap()
        .into_parts();

    let user = AuthUser::from_request_parts(&mut parts, &state)
        .await
        .expect("authorized");
    assert_eq!(user.user_id, user_id);
}

#[tokio::test]
async fn auth_user_rejects_invalid_token() {
    let jwt = MockTokenValidator::rejecting();
    let config = common::test_config();
    let state = test_state(jwt, &config);
    let (mut parts, _) = Request::builder()
        .uri("/")
        .header(AUTHORIZATION, "Bearer bad")
        .body(())
        .unwrap()
        .into_parts();

    assert!(matches!(
        AuthUser::from_request_parts(&mut parts, &state).await,
        Err(AppError::Unauthorized(_))
    ));
}

#[tokio::test]
async fn optional_auth_allows_anonymous_requests() {
    let jwt = MockTokenValidator::accepting(Uuid::new_v4());
    let config = common::test_config();
    let state = test_state(jwt, &config);
    let (mut parts, _) = Request::builder().uri("/").body(()).unwrap().into_parts();

    let auth = OptionalAuth::from_request_parts(&mut parts, &state)
        .await
        .expect("anonymous ok");
    assert!(auth.user.is_none());
    assert!(auth.token.is_none());
}

#[tokio::test]
async fn optional_auth_treats_malformed_bearer_as_anonymous() {
    let jwt = MockTokenValidator::accepting(Uuid::new_v4());
    let config = common::test_config();
    let state = test_state(jwt, &config);
    let (mut parts, _) = Request::builder()
        .uri("/")
        .header(AUTHORIZATION, "Bearer")
        .body(())
        .unwrap()
        .into_parts();

    let auth = OptionalAuth::from_request_parts(&mut parts, &state)
        .await
        .expect("malformed bearer treated as anonymous");
    assert!(auth.user.is_none());
    assert!(auth.token.is_none());
}

#[tokio::test]
async fn optional_auth_accepts_valid_bearer() {
    let user_id = Uuid::new_v4();
    let jwt = MockTokenValidator::accepting(user_id);
    let config = common::test_config();
    let state = test_state(jwt, &config);
    let (mut parts, _) = Request::builder()
        .uri("/")
        .header(AUTHORIZATION, "Bearer feed-token")
        .body(())
        .unwrap()
        .into_parts();

    let auth = OptionalAuth::from_request_parts(&mut parts, &state)
        .await
        .expect("optional auth");
    assert_eq!(auth.user.as_ref().map(|u| u.user_id), Some(user_id));
    assert_eq!(auth.token.as_deref(), Some("feed-token"));
}
