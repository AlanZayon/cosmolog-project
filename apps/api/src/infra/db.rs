use std::str::FromStr;

use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use sqlx::PgPool;

/// Creates the runtime connection pool.
///
/// Statement cache is disabled so the pool works with Supabase transaction pooler (pgbouncer).
pub async fn create_pool(database_url: &str) -> Result<PgPool, sqlx::Error> {
    let options = PgConnectOptions::from_str(database_url)?.statement_cache_capacity(0);

    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect_with(options)
        .await?;

    tracing::info!(event = "db.connected", "connected to PostgreSQL");
    Ok(pool)
}
