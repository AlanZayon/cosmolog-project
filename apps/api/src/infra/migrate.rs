use sqlx::postgres::PgPoolOptions;
use std::path::Path;

/// Applies pending migrations from `apps/api/migrations/`.
///
/// Uses a dedicated single-connection pool. Prefer `migrate_database_url` (session pooler or
/// direct) — transaction pooler (:6543) is not compatible with sqlx migrations.
///
/// Migrations are read from disk at runtime (not compile-time embed) so dev/docker picks up new
/// SQL files without requiring a rebuild after `sqlx migrate run`.
pub async fn run(migrate_database_url: &str) -> anyhow::Result<()> {
    tracing::info!(
        event = "db.migrations_started",
        "running database migrations"
    );

    let pool = PgPoolOptions::new()
        .max_connections(1)
        .connect(migrate_database_url)
        .await?;

    repair_known_migration_issues(&pool).await?;

    let migrator = sqlx::migrate::Migrator::new(Path::new("./migrations")).await?;
    migrator.run(&pool).await?;

    tracing::info!(
        event = "db.migrations_completed",
        "database migrations complete"
    );
    Ok(())
}

/// One-time fixes for renamed or duplicate sqlx migration records.
async fn repair_known_migration_issues(pool: &sqlx::PgPool) -> anyhow::Result<()> {
    // `20260525200000` was a duplicate of `20260525183000` (comment replies).
    let deleted = sqlx::query(
        r#"
        DELETE FROM _sqlx_migrations
        WHERE version = 20260525200000
          AND EXISTS (
            SELECT 1 FROM _sqlx_migrations WHERE version = 20260525183000
          )
        "#,
    )
    .execute(pool)
    .await?
    .rows_affected();

    if deleted > 0 {
        tracing::warn!(
            event = "db.migrations_repaired",
            removed_version = 20260525200000_i64,
            kept_version = 20260525183000_i64,
            "removed duplicate sqlx migration record"
        );
    }

    // Renamed migration file: keep the canonical version on disk.
    let renamed = sqlx::query(
        r#"
        UPDATE _sqlx_migrations
        SET version = 20260525183000,
            description = 'comment replies and likes'
        WHERE version = 20260525200000
          AND NOT EXISTS (
            SELECT 1 FROM _sqlx_migrations WHERE version = 20260525183000
          )
        "#,
    )
    .execute(pool)
    .await?
    .rows_affected();

    if renamed > 0 {
        tracing::warn!(
            event = "db.migrations_repaired",
            from_version = 20260525200000_i64,
            to_version = 20260525183000_i64,
            "renamed sqlx migration record to match repository"
        );
    }

    Ok(())
}
