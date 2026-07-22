use std::time::{SystemTime, UNIX_EPOCH};

use cosmolog_api::auth::{JWT_AUDIENCE, JWT_ISSUER};
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use serde::Serialize;
use uuid::Uuid;

use super::TEST_JWT_SECRET;

#[derive(Serialize)]
struct TestClaims {
    sub: Uuid,
    aud: String,
    iss: String,
    exp: i64,
    iat: i64,
    role: String,
    email: Option<String>,
}

fn encoding_key() -> EncodingKey {
    EncodingKey::from_secret(TEST_JWT_SECRET.as_bytes())
}

pub fn now_unix() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock")
        .as_secs() as i64
}

fn sign_claims(claims: &TestClaims) -> String {
    encode(&Header::new(Algorithm::HS256), claims, &encoding_key()).expect("sign jwt")
}

pub fn sign_token(user_id: Uuid, exp_unix: i64) -> String {
    sign_claims(&TestClaims {
        sub: user_id,
        aud: JWT_AUDIENCE.into(),
        iss: JWT_ISSUER.into(),
        exp: exp_unix,
        iat: now_unix(),
        role: "authenticated".into(),
        email: Some("test@example.com".into()),
    })
}

pub fn sign_valid_token(user_id: Uuid) -> String {
    sign_token(user_id, now_unix() + 3600)
}

#[allow(dead_code)]
pub fn sign_expired_token(user_id: Uuid) -> String {
    sign_token(user_id, now_unix() - 3600)
}

#[allow(dead_code)]
pub fn sign_wrong_audience_token(user_id: Uuid) -> String {
    sign_claims(&TestClaims {
        sub: user_id,
        aud: "wrong-audience".into(),
        iss: JWT_ISSUER.into(),
        exp: now_unix() + 3600,
        iat: now_unix(),
        role: "authenticated".into(),
        email: None,
    })
}

#[allow(dead_code)]
pub fn sign_anon_role_token(user_id: Uuid) -> String {
    sign_claims(&TestClaims {
        sub: user_id,
        aud: JWT_AUDIENCE.into(),
        iss: JWT_ISSUER.into(),
        exp: now_unix() + 3600,
        iat: now_unix(),
        role: "anon".into(),
        email: None,
    })
}

#[allow(dead_code)]
pub fn sign_wrong_secret_token(user_id: Uuid) -> String {
    let claims = TestClaims {
        sub: user_id,
        aud: JWT_AUDIENCE.into(),
        iss: JWT_ISSUER.into(),
        exp: now_unix() + 3600,
        iat: now_unix(),
        role: "authenticated".into(),
        email: None,
    };
    encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(b"some-other-secret-some-other-secret-123"),
    )
    .expect("sign jwt")
}
