use anyhow::{Context, Result};

#[derive(Debug, Clone)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub database_url: String,
    /// Connection used only for sqlx migrations (defaults from `MIGRATE_DATABASE_URL` or `database_url`).
    pub migrate_database_url: String,
    pub cors_allowed_origin: String,
    pub run_migrations: bool,
    pub supabase_url: String,
    pub supabase_jwt_issuer: String,
    pub supabase_jwks_url: String,
    pub supabase_jwt_audience: String,
    pub supabase_anon_key: String,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let host = std::env::var("API_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        let port = std::env::var("API_PORT")
            .unwrap_or_else(|_| "8080".to_string())
            .parse::<u16>()
            .context("API_PORT must be a valid port number")?;
        let database_url_raw =
            std::env::var("DATABASE_URL").context("DATABASE_URL is required")?;
        let default_database_url = normalize_supabase_database_url(&database_url_raw);
        let database_url = std::env::var("RUNTIME_DATABASE_URL")
            .map(|url| strip_connect_param(&url, "pgbouncer"))
            .unwrap_or_else(|_| default_database_url.clone());
        let migrate_database_url = std::env::var("MIGRATE_DATABASE_URL")
            .map(|url| strip_connect_param(&url, "pgbouncer"))
            .unwrap_or(default_database_url);
        let cors_allowed_origin = std::env::var("CORS_ALLOWED_ORIGIN")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());
        let run_migrations = env_bool("RUN_MIGRATIONS", true);
        let supabase_url = std::env::var("SUPABASE_URL")
            .context("SUPABASE_URL is required (e.g. https://<project-ref>.supabase.co)")?;
        let supabase_url = supabase_url.trim_end_matches('/').to_string();
        let supabase_jwt_audience = std::env::var("SUPABASE_JWT_AUDIENCE")
            .unwrap_or_else(|_| "authenticated".to_string());
        let supabase_jwt_issuer = format!("{supabase_url}/auth/v1");
        let supabase_jwks_url = format!("{supabase_jwt_issuer}/.well-known/jwks.json");
        let supabase_anon_key = std::env::var("SUPABASE_ANON_KEY")
            .or_else(|_| std::env::var("SUPABASE_PUBLISHABLE_KEY"))
            .context(
                "SUPABASE_ANON_KEY (or SUPABASE_PUBLISHABLE_KEY) is required for auth/storage proxy",
            )?;

        Ok(Self {
            host,
            port,
            database_url,
            migrate_database_url,
            cors_allowed_origin,
            run_migrations,
            supabase_url,
            supabase_jwt_issuer,
            supabase_jwks_url,
            supabase_jwt_audience,
            supabase_anon_key,
        })
    }

    pub fn socket_addr(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }
}

/// Supabase transaction pooler (:6543) breaks sqlx prepared statements; use session pooler (:5432).
fn normalize_supabase_database_url(database_url: &str) -> String {
    let url = if database_url.contains("pooler.supabase.com:6543") {
        tracing::info!(
            "rewriting DATABASE_URL from transaction pooler :6543 to session pooler :5432 for sqlx"
        );
        database_url.replace("pooler.supabase.com:6543", "pooler.supabase.com:5432")
    } else {
        database_url.to_string()
    };

    strip_connect_param(&url, "pgbouncer")
}

/// sqlx does not understand Supabase-only connect flags such as `pgbouncer=true`.
fn strip_connect_param(database_url: &str, key: &str) -> String {
    let Some((base, query)) = database_url.split_once('?') else {
        return database_url.to_string();
    };

    let filtered: Vec<&str> = query
        .split('&')
        .filter(|pair| pair.split('=').next().is_some_and(|name| name != key))
        .collect();

    if filtered.is_empty() {
        base.to_string()
    } else {
        format!("{base}?{}", filtered.join("&"))
    }
}

fn env_bool(key: &str, default: bool) -> bool {
    match std::env::var(key) {
        Ok(value) => matches!(
            value.to_lowercase().as_str(),
            "1" | "true" | "yes" | "on"
        ),
        Err(_) => default,
    }
}
