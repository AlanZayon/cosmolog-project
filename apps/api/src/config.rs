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
            .or_else(|_| std::env::var("PORT"))
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

    /// Fixed config for unit/integration tests (no env vars, no network).
    #[cfg(test)]
    pub fn test_fixture() -> Self {
        let supabase_url = "https://test-project.supabase.co".to_string();
        let supabase_jwt_issuer = format!("{supabase_url}/auth/v1");
        Self {
            host: "127.0.0.1".into(),
            port: 8080,
            database_url: "postgres://cosmolog:cosmolog@127.0.0.1:5433/cosmolog_test".into(),
            migrate_database_url: "postgres://cosmolog:cosmolog@127.0.0.1:5433/cosmolog_test".into(),
            cors_allowed_origin: "http://localhost:3000".into(),
            run_migrations: false,
            supabase_url: supabase_url.clone(),
            supabase_jwt_issuer: supabase_jwt_issuer.clone(),
            supabase_jwks_url: format!("{supabase_jwt_issuer}/.well-known/jwks.json"),
            supabase_jwt_audience: "authenticated".into(),
            supabase_anon_key: "test-anon-key".into(),
        }
    }
}

/// Supabase transaction pooler (:6543) breaks sqlx prepared statements; use session pooler (:5432).
fn normalize_supabase_database_url(database_url: &str) -> String {
    let url = if database_url.contains("pooler.supabase.com:6543") {
        tracing::info!(
            event = "config.database_url_rewritten",
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

#[cfg(test)]
mod tests {
    use super::{env_bool, normalize_supabase_database_url, strip_connect_param};

    #[test]
    fn rewrites_transaction_pooler_port_to_session_pooler() {
        let url = "postgres://user:pass@aws-0.pooler.supabase.com:6543/postgres";
        let out = normalize_supabase_database_url(url);
        assert!(out.contains(":5432"));
        assert!(!out.contains(":6543"));
    }

    #[test]
    fn leaves_non_pooler_urls_unchanged() {
        let url = "postgres://user:pass@localhost:5432/mydb";
        assert_eq!(normalize_supabase_database_url(url), url);
    }

    #[test]
    fn strips_pgbouncer_connect_param() {
        let url = "postgres://localhost/db?sslmode=require&pgbouncer=true";
        assert_eq!(
            strip_connect_param(url, "pgbouncer"),
            "postgres://localhost/db?sslmode=require"
        );
    }

    #[test]
    fn strip_connect_param_no_query() {
        let url = "postgres://localhost/db";
        assert_eq!(strip_connect_param(url, "pgbouncer"), url);
    }

    #[test]
    fn strip_connect_param_only_pgbouncer() {
        let url = "postgres://localhost/db?pgbouncer=true";
        assert_eq!(strip_connect_param(url, "pgbouncer"), "postgres://localhost/db");
    }

    #[test]
    fn env_bool_parses_truthy_values() {
        std::env::set_var("TEST_BOOL_FLAG", "yes");
        assert!(env_bool("TEST_BOOL_FLAG", false));
        std::env::remove_var("TEST_BOOL_FLAG");
    }

    #[test]
    fn env_bool_uses_default_when_unset() {
        assert!(env_bool("TEST_BOOL_FLAG_DEFINITELY_UNSET_XYZ", true));
        assert!(!env_bool("TEST_BOOL_FLAG_DEFINITELY_UNSET_XYZ", false));
    }

    #[test]
    fn env_port_fallback_for_render() {
        std::env::set_var("PORT", "10000");
        std::env::remove_var("API_PORT");
        let port = std::env::var("API_PORT")
            .or_else(|_| std::env::var("PORT"))
            .unwrap_or_else(|_| "8080".to_string());
        assert_eq!(port, "10000");
        std::env::remove_var("PORT");
    }

    #[test]
    fn test_fixture_has_required_fields() {
        let cfg = super::Config::test_fixture();
        assert_eq!(cfg.supabase_anon_key, "test-anon-key");
        assert!(cfg.supabase_jwks_url.ends_with("/.well-known/jwks.json"));
    }
}
