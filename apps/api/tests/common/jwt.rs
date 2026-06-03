use std::time::{SystemTime, UNIX_EPOCH};

use cosmolog_api::config::Config;
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use serde::Serialize;
use uuid::Uuid;

#[allow(dead_code)]
pub const TEST_KID: &str = "test-rsa-key";
#[allow(dead_code)]
pub const TEST_ISSUER: &str = "https://test.example/auth/v1";
#[allow(dead_code)]
pub const TEST_AUDIENCE: &str = "authenticated";

#[derive(Serialize)]
struct TestClaims {
    sub: Uuid,
    aud: String,
    exp: i64,
    iss: String,
    role: String,
    email: Option<String>,
}

pub fn jwt_test_config(jwks_url: &str) -> Config {
    Config {
        app_env: "test".into(),
        host: "127.0.0.1".into(),
        port: 8080,
        database_url: String::new(),
        migrate_database_url: String::new(),
        cors_allowed_origin: "http://localhost:3000".into(),
        run_migrations: false,
        supabase_url: "https://test.example".into(),
        supabase_jwt_issuer: TEST_ISSUER.into(),
        supabase_jwks_url: jwks_url.into(),
        supabase_jwt_audience: TEST_AUDIENCE.into(),
        supabase_anon_key: "test-anon-key".into(),
        redis_url: None,
    }
}

fn encoding_key() -> EncodingKey {
    let pem = include_str!("../fixtures/auth/rsa-private.pem");
    EncodingKey::from_rsa_pem(pem.as_bytes()).expect("test RSA private key")
}

pub fn now_unix() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock")
        .as_secs() as i64
}

pub fn sign_token(user_id: Uuid, exp_unix: i64) -> String {
    let mut header = Header::new(Algorithm::RS256);
    header.kid = Some(TEST_KID.into());

    let claims = TestClaims {
        sub: user_id,
        aud: TEST_AUDIENCE.into(),
        exp: exp_unix,
        iss: TEST_ISSUER.into(),
        role: "authenticated".into(),
        email: Some("test@example.com".into()),
    };

    encode(&header, &claims, &encoding_key()).expect("sign jwt")
}

pub fn sign_valid_token(user_id: Uuid) -> String {
    sign_token(user_id, now_unix() + 3600)
}

pub fn sign_expired_token(user_id: Uuid) -> String {
    sign_token(user_id, now_unix() - 3600)
}

pub fn sign_wrong_audience_token(user_id: Uuid) -> String {
    let mut header = Header::new(Algorithm::RS256);
    header.kid = Some(TEST_KID.into());

    let claims = TestClaims {
        sub: user_id,
        aud: "wrong-audience".into(),
        exp: now_unix() + 3600,
        iss: TEST_ISSUER.into(),
        role: "authenticated".into(),
        email: None,
    };

    encode(&header, &claims, &encoding_key()).expect("sign jwt")
}

pub fn sign_anon_role_token(user_id: Uuid) -> String {
    let mut header = Header::new(Algorithm::RS256);
    header.kid = Some(TEST_KID.into());

    let claims = TestClaims {
        sub: user_id,
        aud: TEST_AUDIENCE.into(),
        exp: now_unix() + 3600,
        iss: TEST_ISSUER.into(),
        role: "anon".into(),
        email: None,
    };

    encode(&header, &claims, &encoding_key()).expect("sign anon jwt")
}
