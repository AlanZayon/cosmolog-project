use sqlx::postgres::PgPoolOptions;

/// Applies pending migrations from `apps/api/migrations/`.
///
/// Uses a dedicated single-connection pool. Prefer `migrate_database_url` (session pooler or
/// direct) — transaction pooler (:6543) is not compatible with sqlx migrations.
pub async fn run(migrate_database_url: &str) -> anyhow::Result<()> {
    tracing::info!(event = "db.migrations_started", "running database migrations");

    let pool = PgPoolOptions::new()
        .max_connections(1)
        .connect(migrate_database_url)
        .await?;

    sqlx::migrate!("./migrations").run(&pool).await?;

    tracing::info!(event = "db.migrations_completed", "database migrations complete");
    Ok(())
}
