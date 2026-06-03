use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

pub const SERVICE_NAME: &str = "cosmolog-api";

/// Initializes the global tracing subscriber.
///
/// Environment:
/// - `RUST_LOG` — filter directives (default: `cosmolog_api=info,sqlx=warn`)
/// - `LOG_FORMAT` — `json` or `pretty` (default: `json` in production, `pretty` otherwise)
/// - `APP_ENV` — included in startup log (default: `development`)
pub fn init_tracing() {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("cosmolog_api=info,sqlx=warn"));

    let app_env = std::env::var("APP_ENV").unwrap_or_else(|_| "development".to_string());
    let log_format = resolve_log_format(&app_env);

    let layer = fmt::layer().with_target(false);

    match log_format.as_str() {
        "json" => {
            tracing_subscriber::registry()
                .with(filter)
                .with(layer.json().flatten_event(true))
                .init();
        }
        _ => {
            tracing_subscriber::registry()
                .with(filter)
                .with(layer.pretty())
                .init();
        }
    }

    tracing::info!(
        event = "service.tracing_initialized",
        service = SERVICE_NAME,
        env = %app_env,
        log_format = %log_format,
        "tracing initialized"
    );
}

fn resolve_log_format(app_env: &str) -> String {
    if let Ok(format) = std::env::var("LOG_FORMAT") {
        return format.to_lowercase();
    }

    if app_env == "production" {
        "json".to_string()
    } else {
        "pretty".to_string()
    }
}

/// Records the authenticated user on the current request span.
pub fn record_user_id(user_id: uuid::Uuid) {
    tracing::Span::current().record("user_id", tracing::field::display(&user_id));
}
