use std::sync::Arc;

use anyhow::Result;
use sqlx::PgPool;

use crate::auth::TokenValidator;
use crate::config::Config;
use crate::domain::notifications::NotificationEventBus;
use crate::infra::supabase::SupabaseClient;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub jwt: Arc<dyn TokenValidator>,
    pub supabase: SupabaseClient,
    pub notification_events: NotificationEventBus,
}

impl AppState {
    /// Local in-memory notification bus only (tests and single-instance dev without Redis).
    pub fn new(pool: PgPool, jwt: Arc<dyn TokenValidator>, config: &Config) -> Self {
        Self {
            pool,
            jwt,
            supabase: SupabaseClient::new(&config.supabase_url, &config.supabase_anon_key),
            notification_events: NotificationEventBus::new_local(),
        }
    }

    /// Production startup: connect Redis subscriber when `REDIS_URL` is configured.
    pub async fn try_new(
        pool: PgPool,
        jwt: Arc<dyn TokenValidator>,
        config: &Config,
    ) -> Result<Self> {
        let notification_events = match config.redis_url.as_deref() {
            Some(redis_url) => {
                tracing::info!(
                    event = "notifications.realtime.redis_enabled",
                    "notification realtime using redis pub/sub"
                );
                NotificationEventBus::connect(redis_url).await?
            }
            None => {
                tracing::info!(
                    event = "notifications.realtime.local_only",
                    "notification realtime using in-memory bus (single instance)"
                );
                NotificationEventBus::new_local()
            }
        };

        Ok(Self {
            pool,
            jwt,
            supabase: SupabaseClient::new(&config.supabase_url, &config.supabase_anon_key),
            notification_events,
        })
    }
}
