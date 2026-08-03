use cosmolog_api::config::Config;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;

pub mod app;
pub mod db;
pub mod fixtures;
pub mod jwt;

/// Shared HS256 secret for tests (matches `jwt::sign_valid_token`).
#[allow(dead_code)]
pub const TEST_JWT_SECRET: &str = "test-jwt-secret-test-jwt-secret-0123456789";

#[allow(dead_code)]
pub fn test_config() -> Config {
    Config {
        app_env: "test".into(),
        host: "127.0.0.1".into(),
        port: 8080,
        database_url: "postgres://cosmolog:cosmolog@127.0.0.1:5433/cosmolog_test".into(),
        migrate_database_url: "postgres://cosmolog:cosmolog@127.0.0.1:5433/cosmolog_test".into(),
        cors_allowed_origin: "http://localhost:3000".into(),
        run_migrations: false,
        auth_jwt_secret: TEST_JWT_SECRET.into(),
        require_email_confirmation: false,
        app_public_url: "http://localhost:3000".into(),
        google: None,
        smtp_url: None,
        ses_from_email: None,
        s3_bucket: None,
        s3_endpoint: None,
        s3_public_base_url: Some("https://cdn.test.example".into()),
        legacy_supabase_url: None,
        redis_url: None,
        redis_feed_url: None,
        feed_source_mode: "sql".into(),
        feed_sql_delivery_log: true,
    }
}

#[allow(dead_code)]
pub async fn connect_test_pool() -> PgPool {
    let url = std::env::var("TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://cosmolog:cosmolog@127.0.0.1:5433/cosmolog_test".into());
    PgPoolOptions::new()
        .max_connections(5)
        .connect(&url)
        .await
        .expect("connect TEST_DATABASE_URL — run: docker compose -f docker-compose.test.yml up -d")
}
