use cosmolog_api::config::Config;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;

pub mod app;
pub mod db;
pub mod fixtures;
pub mod jwt;

#[allow(dead_code)]
pub fn test_config() -> Config {
    let supabase_url = "https://test-project.supabase.co".to_string();
    let supabase_jwt_issuer = format!("{supabase_url}/auth/v1");
    Config {
        app_env: "test".into(),
        host: "127.0.0.1".into(),
        port: 8080,
        database_url: "postgres://cosmolog:cosmolog@127.0.0.1:5433/cosmolog_test".into(),
        migrate_database_url: "postgres://cosmolog:cosmolog@127.0.0.1:5433/cosmolog_test".into(),
        cors_allowed_origin: "http://localhost:3000".into(),
        run_migrations: false,
        supabase_url: supabase_url.clone(),
        supabase_jwt_issuer: supabase_jwt_issuer.clone(),
        supabase_jwks_url: format!("{supabase_jwt_issuer}/.well-known/jwks.json"),
        supabase_jwt_audience: "authenticated".into(),
        supabase_anon_key: "test-anon-key".into(),
        redis_url: None,
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
