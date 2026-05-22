use std::sync::Arc;

use sqlx::PgPool;

use crate::auth::JwtValidator;
use crate::config::Config;
use crate::infra::supabase::SupabaseClient;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub jwt: Arc<JwtValidator>,
    pub supabase: SupabaseClient,
}

impl AppState {
    pub fn new(pool: PgPool, jwt: Arc<JwtValidator>, config: &Config) -> Self {
        Self {
            pool,
            jwt,
            supabase: SupabaseClient::new(&config.supabase_url, &config.supabase_anon_key),
        }
    }
}
