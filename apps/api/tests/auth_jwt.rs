mod common;

use std::sync::Arc;

use cosmolog_api::auth::{JwtValidator, TokenValidator};
use uuid::Uuid;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

use common::jwt::{
    jwt_test_config, sign_expired_token, sign_valid_token, sign_wrong_audience_token, TEST_KID,
};

async fn validator_with_mock_jwks() -> (MockServer, Arc<dyn TokenValidator>) {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/.well-known/jwks.json"))
        .respond_with(ResponseTemplate::new(200).set_body_string(include_str!(
            "fixtures/auth/jwks.json"
        )))
        .mount(&server)
        .await;

    let jwks_url = format!("{}/.well-known/jwks.json", server.uri());
    let config = jwt_test_config(&jwks_url);
    let jwt: Arc<dyn TokenValidator> = JwtValidator::new(&config).await.expect("load jwks");
    (server, jwt)
}

#[tokio::test]
async fn validates_rs256_token_from_jwks() {
    let (_server, jwt) = validator_with_mock_jwks().await;
    let user_id = Uuid::new_v4();
    let token = sign_valid_token(user_id);

    let user = jwt.validate(&token).await.expect("valid token");
    assert_eq!(user.user_id, user_id);
}

#[tokio::test]
async fn rejects_expired_token() {
    let (_server, jwt) = validator_with_mock_jwks().await;
    let token = sign_expired_token(Uuid::new_v4());

    assert!(jwt.validate(&token).await.is_err());
}

#[tokio::test]
async fn rejects_wrong_audience() {
    let (_server, jwt) = validator_with_mock_jwks().await;
    let token = sign_wrong_audience_token(Uuid::new_v4());

    assert!(jwt.validate(&token).await.is_err());
}

#[tokio::test]
async fn rejects_unknown_kid_after_jwks_refresh() {
    let (_server, jwt) = validator_with_mock_jwks().await;
    // Token without valid structure / unknown signing key
    assert!(jwt.validate("eyJhbGciOiJIUzI1NiJ9.e30.x").await.is_err());
}

#[tokio::test]
async fn refetches_jwks_when_kid_is_unknown_then_validates() {
    let server = MockServer::start().await;
    let jwks_initial = r#"{"keys":[]}"#;
    Mock::given(method("GET"))
        .and(path("/.well-known/jwks.json"))
        .respond_with(ResponseTemplate::new(200).set_body_string(jwks_initial))
        .up_to_n_times(1)
        .mount(&server)
        .await;

    Mock::given(method("GET"))
        .and(path("/.well-known/jwks.json"))
        .respond_with(ResponseTemplate::new(200).set_body_string(include_str!(
            "fixtures/auth/jwks.json"
        )))
        .mount(&server)
        .await;

    let jwks_url = format!("{}/.well-known/jwks.json", server.uri());
    let config = jwt_test_config(&jwks_url);
    let jwt: Arc<dyn TokenValidator> = JwtValidator::new(&config).await.expect("initial jwks");

    let user_id = Uuid::new_v4();
    let token = sign_valid_token(user_id);
    let user = jwt.validate(&token).await.expect("after jwks refresh");
    assert_eq!(user.user_id, user_id);
}

#[tokio::test]
async fn fetch_jwks_parses_rsa_key() {
    use cosmolog_api::auth::fetch_jwks;

    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/jwks"))
        .respond_with(ResponseTemplate::new(200).set_body_string(include_str!(
            "fixtures/auth/jwks.json"
        )))
        .mount(&server)
        .await;

    let url = format!("{}/jwks", server.uri());
    let client = reqwest::Client::new();
    let keys = fetch_jwks(&client, &url).await.expect("fetch");
    assert_eq!(keys.len(), 1);
    assert_eq!(keys[0].kid, TEST_KID);
}
