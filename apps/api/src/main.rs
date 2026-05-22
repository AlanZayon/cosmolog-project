mod app;
mod auth;
mod config;
mod domain;
mod error;
mod infra;
mod routes;
mod state;

use anyhow::Result;
use axum::serve;
use tokio::net::TcpListener;
use tracing_subscriber::{fmt, EnvFilter};

use crate::auth::JwtValidator;
use crate::config::Config;
use crate::infra::db::create_pool;
use crate::infra::migrate;
use crate::state::AppState;

fn init_tracing() {
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| {
        EnvFilter::new("cosmolog_api=info,tower_http=info,sqlx=warn")
    });

    fmt()
        .json()
        .with_env_filter(filter)
        .with_current_span(false)
        .init();
}

#[tokio::main]
async fn main() -> Result<()> {
    let _ = dotenvy::dotenv();

    init_tracing();

    let config = Config::from_env()?;
    let pool = create_pool(&config.database_url).await?;

    if config.run_migrations {
        migrate::run(&config.migrate_database_url).await?;
        tracing::info!("database migrations applied");
    }

    let jwt = JwtValidator::new(&config).await?;
    let state = AppState::new(pool, jwt, &config);

    let listener = TcpListener::bind(config.socket_addr()).await?;
    tracing::info!(addr = %config.socket_addr(), "listening");

    let app = app::router(state, &config);
    serve(listener, app).await?;

    Ok(())
}
