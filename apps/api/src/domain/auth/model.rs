use serde::Serialize;
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct UserRecord {
    pub id: Uuid,
    pub email: Option<String>,
    pub password_hash: Option<String>,
    pub email_verified_at: Option<OffsetDateTime>,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Clone, Serialize)]
pub struct SessionUser {
    pub id: Uuid,
    pub email: Option<String>,
}

/// Session payload returned to the Next BFF (same shape the Supabase proxy used).
#[derive(Debug, Clone, Serialize)]
pub struct AuthSession {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64,
    pub token_type: String,
    pub user: SessionUser,
}

#[derive(Debug)]
pub enum SignUpOutcome {
    Session(AuthSession),
    PendingConfirmation { user_id: Uuid, email: String },
}
