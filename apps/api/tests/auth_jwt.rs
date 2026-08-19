mod common;

use std::sync::Arc;

use cosmolog_api::auth::{JwtSigner, TokenValidator};
use uuid::Uuid;

use common::jwt::{
    sign_anon_role_token, sign_expired_token, sign_valid_token, sign_wrong_audience_token,
    sign_wrong_secret_token,
};
use common::TEST_JWT_SECRET;

fn validator() -> Arc<dyn TokenValidator> {
    Arc::new(JwtSigner::from_secret(TEST_JWT_SECRET.as_bytes()))
}

#[tokio::test]
async fn validates_hs256_token() {
    let jwt = validator();
    let user_id = Uuid::new_v4();
    let token = sign_valid_token(user_id);

    let user = jwt.validate(&token).await.expect("valid token");
    assert_eq!(user.user_id, user_id);
    assert_eq!(user.role, "authenticated");
}

#[tokio::test]
async fn validates_token_issued_by_signer() {
    let signer = JwtSigner::from_secret(TEST_JWT_SECRET.as_bytes());
    let user_id = Uuid::new_v4();
    let (token, expires_in) = signer.sign(user_id, Some("a@b.com")).expect("sign");
    assert!(expires_in > 0);

    let user = validator().validate(&token).await.expect("valid token");
    assert_eq!(user.user_id, user_id);
    assert_eq!(user.email.as_deref(), Some("a@b.com"));
}

#[tokio::test]
async fn rejects_expired_token() {
    assert!(validator()
        .validate(&sign_expired_token(Uuid::new_v4()))
        .await
        .is_err());
}

#[tokio::test]
async fn rejects_wrong_audience() {
    assert!(validator()
        .validate(&sign_wrong_audience_token(Uuid::new_v4()))
        .await
        .is_err());
}

#[tokio::test]
async fn rejects_anon_role_token() {
    assert!(validator()
        .validate(&sign_anon_role_token(Uuid::new_v4()))
        .await
        .is_err());
}

#[tokio::test]
async fn rejects_token_signed_with_other_secret() {
    assert!(validator()
        .validate(&sign_wrong_secret_token(Uuid::new_v4()))
        .await
        .is_err());
}

#[tokio::test]
async fn rejects_malformed_token() {
    assert!(validator()
        .validate("eyJhbGciOiJIUzI1NiJ9.e30.x")
        .await
        .is_err());
    assert!(validator().validate("not-a-jwt").await.is_err());
}
