use std::sync::Arc;

use anyhow::Result;
use axum::serve;
use cosmolog_api::auth::{JwtValidator, TokenValidator};
use cosmolog_api::config::Config;
use cosmolog_api::infra::db::create_pool;
use cosmolog_api::infra::logging;
use cosmolog_api::infra::migrate;
use cosmolog_api::state::AppState;
use tokio::net::TcpListener;

#[tokio::main]
async fn main() -> Result<()> {
    let _ = dotenvy::dotenv();

    logging::init_tracing();

    let config = Config::from_env()?;
    let pool = create_pool(&config.database_url).await?;

    if config.run_migrations {
        migrate::run(&config.migrate_database_url).await?;
        tracing::info!(
            event = "db.migrations_applied",
            "database migrations applied"
        );
    }

    let jwt: Arc<dyn TokenValidator> = JwtValidator::new(&config).await?;
    let state = AppState::try_new(pool, jwt, &config).await?;

    let listener = TcpListener::bind(config.socket_addr()).await?;
    tracing::info!(
        event = "service.listening",
        addr = %config.socket_addr(),
        "listening"
    );

    let app = cosmolog_api::app::router(state, &config);
    serve(listener, app).await?;

    Ok(())
}
