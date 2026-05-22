use serde::Deserialize;
use uuid::Uuid;

/// Supabase Auth JWT claims (access token).
#[derive(Debug, Deserialize)]
pub struct SupabaseClaims {
    pub sub: Uuid,
    #[allow(dead_code)]
    pub aud: serde_json::Value,
    #[allow(dead_code)]
    pub exp: i64,
    #[allow(dead_code)]
    pub iat: Option<i64>,
    pub role: Option<String>,
    pub email: Option<String>,
}
