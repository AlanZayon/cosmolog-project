use anyhow::{Context, Result};

/// Default access-token TTL in seconds.
pub const ACCESS_TOKEN_TTL_SECONDS: i64 = 3600;
/// Refresh-token TTL in days (matches the BFF refresh cookie).
pub const REFRESH_TOKEN_TTL_DAYS: i64 = 30;

const DEFAULT_GOOGLE_TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const DEFAULT_GOOGLE_ISSUERS: &[&str] = &["https://accounts.google.com", "accounts.google.com"];

#[derive(Debug, Clone)]
pub struct GoogleOAuthConfig {
    pub client_id: String,
    pub client_secret: String,
    /// Token endpoint (Google or local Fake IdP).
    pub token_url: String,
    /// Accepted `iss` values on the ID token.
    pub issuers: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct Config {
    pub app_env: String,
    pub host: String,
    pub port: u16,
    pub database_url: String,
    /// Connection used only for sqlx migrations (defaults from `MIGRATE_DATABASE_URL` or `database_url`).
    pub migrate_database_url: String,
    pub cors_allowed_origin: String,
    pub run_migrations: bool,
    /// HMAC secret used to sign/validate access tokens (HS256).
    pub auth_jwt_secret: String,
    /// When true, sign-up requires confirming the email before sign-in.
    pub require_email_confirmation: bool,
    /// Public URL of the web app, used to build email links (confirm/reset).
    pub app_public_url: String,
    /// Google OAuth client (direct, no Supabase provider).
    pub google: Option<GoogleOAuthConfig>,
    /// SMTP URL for local/dev mail (e.g. `smtp://mailpit:1025`). Takes priority over SES.
    pub smtp_url: Option<String>,
    /// Amazon SES sender address. When unset (and no SMTP), emails are logged instead.
    pub ses_from_email: Option<String>,
    /// Amazon S3 / MinIO bucket for image uploads.
    pub s3_bucket: Option<String>,
    /// Optional custom S3 API endpoint (MinIO path-style). When unset, uses AWS virtual-host.
    pub s3_endpoint: Option<String>,
    /// Public base URL serving uploaded objects (S3 website/CloudFront/MinIO).
    pub s3_public_base_url: Option<String>,
    /// Legacy Supabase project URL: keeps previously stored image URLs valid.
    pub legacy_supabase_url: Option<String>,
    /// Redis URL for cross-instance notification SSE fan-out (`redis://host:6379`).
    pub redis_url: Option<String>,
    /// Redis URL for feed-serving timelines (typically DB 2: `redis://host:6379/2`).
    pub redis_feed_url: Option<String>,
    /// Feed Gateway mode: `sql` | `shadow` | `canary` | `engine` (`FEATURE_FEED_SOURCE`).
    pub feed_source_mode: String,
    /// When true, authenticated `GET /feed` upserts into `feed_deliveries` (SQL ranking anti-repeat).
    pub feed_sql_delivery_log: bool,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let app_env = std::env::var("APP_ENV").unwrap_or_else(|_| "development".to_string());
        let is_production = app_env == "production";
        let host = std::env::var("API_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        let port = std::env::var("API_PORT")
            .or_else(|_| std::env::var("PORT"))
            .unwrap_or_else(|_| "8080".to_string())
            .parse::<u16>()
            .context("API_PORT must be a valid port number")?;
        let database_url_raw = std::env::var("DATABASE_URL").context("DATABASE_URL is required")?;
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

        let auth_jwt_secret = match std::env::var("AUTH_JWT_SECRET") {
            Ok(secret) => {
                let secret = secret.trim().to_string();
                if secret.len() < 32 {
                    anyhow::bail!("AUTH_JWT_SECRET must be at least 32 characters");
                }
                secret
            }
            Err(_) if is_production => {
                anyhow::bail!("AUTH_JWT_SECRET is required when APP_ENV=production")
            }
            Err(_) => {
                tracing::warn!(
                    event = "config.dev_jwt_secret",
                    "AUTH_JWT_SECRET not set; using an insecure development secret"
                );
                "dev-insecure-jwt-secret-do-not-use-in-production".to_string()
            }
        };

        let require_email_confirmation = env_bool("REQUIRE_EMAIL_CONFIRMATION", is_production);
        let app_public_url = std::env::var("APP_PUBLIC_URL")
            .unwrap_or_else(|_| cors_allowed_origin.clone())
            .trim_end_matches('/')
            .to_string();

        let oauth_token_url = non_empty_env("OAUTH_TOKEN_URL")
            .unwrap_or_else(|| DEFAULT_GOOGLE_TOKEN_URL.to_string());
        let oauth_issuers = match non_empty_env("OAUTH_ISSUER") {
            Some(issuer) => vec![issuer],
            None => DEFAULT_GOOGLE_ISSUERS
                .iter()
                .map(|s| (*s).to_string())
                .collect(),
        };

        let google = match (
            non_empty_env("GOOGLE_CLIENT_ID"),
            non_empty_env("GOOGLE_CLIENT_SECRET"),
        ) {
            (Some(client_id), Some(client_secret)) => Some(GoogleOAuthConfig {
                client_id,
                client_secret,
                token_url: oauth_token_url,
                issuers: oauth_issuers,
            }),
            (None, None) => None,
            _ => anyhow::bail!("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together"),
        };

        let smtp_url = non_empty_env("SMTP_URL");
        let ses_from_email = non_empty_env("SES_FROM_EMAIL");
        let s3_bucket = non_empty_env("S3_BUCKET");
        let s3_endpoint =
            non_empty_env("S3_ENDPOINT").map(|url| url.trim_end_matches('/').to_string());
        let s3_public_base_url =
            non_empty_env("S3_PUBLIC_BASE_URL").map(|url| url.trim_end_matches('/').to_string());
        let legacy_supabase_url =
            non_empty_env("LEGACY_SUPABASE_URL").map(|url| url.trim_end_matches('/').to_string());

        let redis_url = non_empty_env("REDIS_URL");
        let redis_feed_url = non_empty_env("REDIS_FEED_URL");
        let feed_source_mode =
            non_empty_env("FEATURE_FEED_SOURCE").unwrap_or_else(|| "sql".to_string());
        let feed_sql_delivery_log = env_bool("FEED_SQL_DELIVERY_LOG", true);

        if is_production {
            if redis_url.is_none() {
                anyhow::bail!("REDIS_URL is required when APP_ENV=production");
            }
            if s3_bucket.is_none() || s3_public_base_url.is_none() {
                anyhow::bail!(
                    "S3_BUCKET and S3_PUBLIC_BASE_URL are required when APP_ENV=production"
                );
            }
            if require_email_confirmation && ses_from_email.is_none() && smtp_url.is_none() {
                anyhow::bail!(
                    "SES_FROM_EMAIL or SMTP_URL is required in production when REQUIRE_EMAIL_CONFIRMATION is enabled"
                );
            }
        }

        Ok(Self {
            app_env,
            host,
            port,
            database_url,
            migrate_database_url,
            cors_allowed_origin,
            run_migrations,
            auth_jwt_secret,
            require_email_confirmation,
            app_public_url,
            google,
            smtp_url,
            ses_from_email,
            s3_bucket,
            s3_endpoint,
            s3_public_base_url,
            legacy_supabase_url,
            redis_url,
            redis_feed_url,
            feed_source_mode,
            feed_sql_delivery_log,
        })
    }

    pub fn socket_addr(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }

    /// Allowed public prefixes for stored image URLs (`{prefix}{bucket}/{path}`).
    pub fn image_url_prefixes(&self) -> Vec<String> {
        let mut prefixes = Vec::new();
        if let Some(base) = &self.s3_public_base_url {
            prefixes.push(format!("{base}/"));
        }
        if let Some(legacy) = &self.legacy_supabase_url {
            prefixes.push(format!("{legacy}/storage/v1/object/public/"));
        }
        prefixes
    }

    /// Fixed config for unit/integration tests (no env vars, no network).
    #[cfg(test)]
    pub fn test_fixture() -> Self {
        Self {
            app_env: "test".into(),
            host: "127.0.0.1".into(),
            port: 8080,
            database_url: "postgres://cosmolog:cosmolog@127.0.0.1:5433/cosmolog_test".into(),
            migrate_database_url: "postgres://cosmolog:cosmolog@127.0.0.1:5433/cosmolog_test"
                .into(),
            cors_allowed_origin: "http://localhost:3000".into(),
            run_migrations: false,
            auth_jwt_secret: "test-jwt-secret-test-jwt-secret-0123456789".into(),
            require_email_confirmation: false,
            app_public_url: "http://localhost:3000".into(),
            google: None,
            smtp_url: None,
            ses_from_email: None,
            s3_bucket: None,
            s3_endpoint: None,
            s3_public_base_url: Some("https://cdn.test.example".into()),
            legacy_supabase_url: None,
            redis_url: None,
            redis_feed_url: None,
            feed_source_mode: "sql".into(),
            feed_sql_delivery_log: true,
        }
    }
}

fn non_empty_env(key: &str) -> Option<String> {
    std::env::var(key)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

/// Supabase transaction pooler (:6543) breaks sqlx prepared statements; use session pooler (:5432).
/// Kept for the transition period while DATABASE_URL may still point at Supabase Postgres.
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

/// sqlx does not understand pgbouncer-only connect flags such as `pgbouncer=true`.
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
        Ok(value) => matches!(value.to_lowercase().as_str(), "1" | "true" | "yes" | "on"),
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
        assert_eq!(
            strip_connect_param(url, "pgbouncer"),
            "postgres://localhost/db"
        );
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
    fn test_fixture_has_required_fields() {
        let cfg = super::Config::test_fixture();
        assert!(cfg.auth_jwt_secret.len() >= 32);
        assert_eq!(
            cfg.image_url_prefixes(),
            vec!["https://cdn.test.example/".to_string()]
        );
    }

    #[test]
    fn image_url_prefixes_include_legacy_supabase() {
        let mut cfg = super::Config::test_fixture();
        cfg.legacy_supabase_url = Some("https://abc.supabase.co".into());
        assert_eq!(
            cfg.image_url_prefixes(),
            vec![
                "https://cdn.test.example/".to_string(),
                "https://abc.supabase.co/storage/v1/object/public/".to_string(),
            ]
        );
    }
}
