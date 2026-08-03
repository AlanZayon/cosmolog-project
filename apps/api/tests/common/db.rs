use std::time::Duration;

use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;

/// Session-scoped lock so parallel test binaries share one DB safely.
const TEST_DB_LOCK_ID: i64 = 0x636f_736d_6f6c_0001;

pub async fn test_db() -> Option<PgPool> {
    let url = std::env::var("TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://cosmolog:cosmolog@127.0.0.1:5433/cosmolog_test".into());
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
    apply_feed_function(pool).await;
}

/// `get_feed` is loaded from the v2 ranking migration (single source of truth).
/// The naive `;` splitter in `apply_schema` would break plpgsql bodies.
async fn apply_feed_function(pool: &PgPool) {
    let sql = include_str!("../../migrations/20260803192840_get_feed_v2_ranking.sql");
    sqlx::raw_sql(sql)
        .execute(pool)
        .await
        .expect("apply get_feed function");
}

/// ALTERs for databases created before newer columns/tables (CREATE IF NOT EXISTS skips existing tables).
async fn apply_schema_patches(pool: &PgPool) {
    let patches = [
        "ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS feed_display_mode TEXT NOT NULL DEFAULT 'preview'",
        "ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS reading_mode TEXT NOT NULL DEFAULT 'vertical'",
        "ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS parent_id UUID",
        "ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE public.library_collections ADD COLUMN IF NOT EXISTS icon TEXT NOT NULL DEFAULT 'folder'",
        "ALTER TABLE public.activity_notifications DROP CONSTRAINT IF EXISTS activity_notifications_kind_refs",
        "ALTER TABLE public.activity_notifications DROP CONSTRAINT IF EXISTS activity_notifications_kind_check",
        "ALTER TABLE public.activity_notifications ADD CONSTRAINT activity_notifications_kind_check CHECK (kind IN ('comment_mention', 'story_comment', 'comment_reply', 'comment_liked', 'profile_alert_activated', 'universe_alert_activated', 'collection_saved'))",
        "ALTER TABLE public.activity_notifications ADD CONSTRAINT activity_notifications_kind_refs CHECK ((kind IN ('comment_mention', 'story_comment', 'comment_reply', 'comment_liked') AND story_id IS NOT NULL AND comment_id IS NOT NULL) OR (kind = 'profile_alert_activated' AND story_id IS NULL AND comment_id IS NULL AND universe_id IS NULL AND collection_id IS NULL) OR (kind = 'universe_alert_activated' AND universe_id IS NOT NULL AND story_id IS NULL AND comment_id IS NULL AND collection_id IS NULL) OR (kind = 'collection_saved' AND collection_id IS NOT NULL AND story_id IS NULL AND comment_id IS NULL AND universe_id IS NULL))",
        r#"CREATE TABLE IF NOT EXISTS public.event_outbox (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            event_id UUID NOT NULL UNIQUE,
            event_type TEXT NOT NULL,
            payload JSONB NOT NULL,
            schema_version INTEGER NOT NULL DEFAULT 1,
            producer TEXT NOT NULL DEFAULT 'api',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            published_at TIMESTAMPTZ,
            attempts INTEGER NOT NULL DEFAULT 0,
            last_error TEXT
        )"#,
        "CREATE INDEX IF NOT EXISTS idx_event_outbox_unpublished ON public.event_outbox (created_at ASC) WHERE published_at IS NULL",
        r#"CREATE TABLE IF NOT EXISTS public.processed_events (
            event_id UUID PRIMARY KEY,
            event_type TEXT NOT NULL,
            processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )"#,
        r#"CREATE TABLE IF NOT EXISTS public.feed_metadata (
            key TEXT PRIMARY KEY,
            value JSONB NOT NULL,
            version INTEGER NOT NULL DEFAULT 1,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )"#,
        r#"INSERT INTO public.feed_metadata (key, value, version)
           VALUES ('weights.global', '{"recency": 1.0, "popularity": 0.6, "following": 2.0, "max_candidates": 500}'::jsonb, 1)
           ON CONFLICT (key) DO NOTHING"#,
        r#"CREATE TABLE IF NOT EXISTS public.feed_deliveries (
            user_id UUID NOT NULL,
            item_type TEXT NOT NULL CHECK (item_type IN ('story', 'arc', 'universe')),
            item_id UUID NOT NULL,
            delivery_count INTEGER NOT NULL DEFAULT 1,
            first_delivered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            last_delivered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (user_id, item_type, item_id)
        )"#,
        "CREATE INDEX IF NOT EXISTS idx_feed_deliveries_recent ON public.feed_deliveries (user_id, last_delivered_at DESC)",
        "CREATE INDEX IF NOT EXISTS idx_likes_story_created ON public.likes (story_id, created_at DESC)",
        "CREATE INDEX IF NOT EXISTS idx_likes_created ON public.likes (created_at DESC)",
        "CREATE INDEX IF NOT EXISTS idx_universes_owner ON public.universes (owner_id)",
        r#"INSERT INTO public.feed_metadata (key, value, version)
           VALUES (
             'weights.sql_feed',
             '{"freshness": 1.0, "half_life_hours": 30.0, "following": 1.2, "engagement": 0.7, "engagement_72h": 0.5, "own": -0.7, "seen": 0.45, "jitter": 0.06, "author_penalty": 0.18, "universe_penalty": 0.10, "tier_arc": -0.30, "tier_universe": -0.45}'::jsonb,
             1
           )
           ON CONFLICT (key) DO NOTHING"#,
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
            processed_events,
            feed_metadata,
            feed_deliveries,
            event_outbox,
            activity_notifications,
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
            profiles,
            oauth_accounts,
            auth_email_tokens,
            auth_refresh_tokens,
            users
        CASCADE",
    )
    .execute(pool)
    .await
    .expect("truncate test tables");

    // Re-seed feed metadata defaults cleared by TRUNCATE.
    let _ = sqlx::query(
        r#"INSERT INTO public.feed_metadata (key, value, version)
           VALUES
             ('weights.global', '{"recency": 1.0, "popularity": 0.6, "following": 2.0, "max_candidates": 500}'::jsonb, 1),
             ('weights.sql_feed', '{"freshness": 1.0, "half_life_hours": 30.0, "following": 1.2, "engagement": 0.7, "engagement_72h": 0.5, "own": -0.7, "seen": 0.45, "jitter": 0.06, "author_penalty": 0.18, "universe_penalty": 0.10, "tier_arc": -0.30, "tier_universe": -0.45}'::jsonb, 1)
           ON CONFLICT (key) DO NOTHING"#,
    )
    .execute(pool)
    .await;
}
