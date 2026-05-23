use std::time::Duration;

use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;

pub async fn test_db() -> Option<PgPool> {
    let url = std::env::var("TEST_DATABASE_URL").unwrap_or_else(|_| {
        "postgres://cosmolog:cosmolog@127.0.0.1:5433/cosmolog_test".into()
    });
    let pool = match PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(Duration::from_secs(3))
        .connect(&url)
        .await
    {
        Ok(pool) => pool,
        Err(e) => {
            eprintln!("SKIP DB tests: could not connect to {url} ({e})");
            eprintln!("  Start Postgres: docker compose -f docker-compose.test.yml up -d");
            return None;
        }
    };
    ensure_schema(&pool).await;
    truncate_all(&pool).await;
    Some(pool)
}

pub async fn ensure_schema(pool: &PgPool) {
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'profiles'
        )",
    )
    .fetch_one(pool)
    .await
    .unwrap_or(false);

    if exists {
        return;
    }

    apply_schema(pool).await;
}

async fn apply_schema(pool: &PgPool) {
    let schema = include_str!("../fixtures/schema.sql");
    for statement in schema
        .split(';')
        .map(str::trim)
        .filter(|s| !s.is_empty() && !s.starts_with("--"))
    {
        sqlx::query(statement)
            .execute(pool)
            .await
            .unwrap_or_else(|e| panic!("schema apply failed: {e}\nSQL: {statement}"));
    }
}

pub async fn truncate_all(pool: &PgPool) {
    sqlx::query(
        "TRUNCATE TABLE
            illustrated_blocks,
            comic_pages,
            chapters,
            comments,
            likes,
            universe_follows,
            stories,
            arcs,
            universes,
            profiles
        CASCADE",
    )
    .execute(pool)
    .await
    .expect("truncate test tables");
}
