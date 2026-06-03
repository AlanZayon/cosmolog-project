use std::time::Duration;

use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;

/// Session-scoped lock so parallel test binaries share one DB safely.
const TEST_DB_LOCK_ID: i64 = 0x636f_736d_6f6c_0001;

pub async fn test_db() -> Option<PgPool> {
    let url = std::env::var("TEST_DATABASE_URL").unwrap_or_else(|_| {
        "postgres://cosmolog:cosmolog@127.0.0.1:5433/cosmolog_test".into()
    });
    let pool = match PgPoolOptions::new()
        // One connection per test: advisory locks are session-scoped and released when the pool drops.
        .max_connections(1)
        .acquire_timeout(Duration::from_secs(30))
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

    if !acquire_test_lock(&pool).await {
        return None;
    }

    ensure_schema(&pool).await;
    truncate_all(&pool).await;
    Some(pool)
}

async fn acquire_test_lock(pool: &PgPool) -> bool {
    match sqlx::query("SELECT pg_advisory_lock($1)")
        .bind(TEST_DB_LOCK_ID)
        .execute(pool)
        .await
    {
        Ok(_) => true,
        Err(e) => {
            eprintln!("SKIP DB tests: could not acquire test DB lock ({e})");
            false
        }
    }
}

pub async fn ensure_schema(pool: &PgPool) {
    // Idempotent (CREATE IF NOT EXISTS): safe on fresh DBs and when new tables are added.
    apply_schema(pool).await;
    apply_schema_patches(pool).await;
}

/// ALTERs for databases created before newer columns/tables (CREATE IF NOT EXISTS skips existing tables).
async fn apply_schema_patches(pool: &PgPool) {
    let patches = [
        "ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS feed_display_mode TEXT NOT NULL DEFAULT 'preview'",
        "ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS parent_id UUID",
        "ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE public.library_collections ADD COLUMN IF NOT EXISTS icon TEXT NOT NULL DEFAULT 'folder'",
    ];
    for sql in patches {
        let _ = sqlx::query(sql).execute(pool).await;
    }
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
            notifications,
            notification_subscriptions,
            illustrated_blocks,
            comic_pages,
            chapters,
            comments,
            comment_likes,
            likes,
            universe_follows,
            library_collection_items,
            library_collections,
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
