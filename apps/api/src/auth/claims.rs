use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Access-token claims issued and validated by this API (HS256).
#[derive(Debug, Serialize, Deserialize)]
pub struct AccessClaims {
    pub sub: Uuid,
    pub aud: String,
    pub iss: String,
    pub exp: i64,
    pub iat: i64,
    pub role: String,
    pub email: Option<String>,
}
