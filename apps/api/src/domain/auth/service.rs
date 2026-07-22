use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::JwtSigner;
use crate::config::{GoogleOAuthConfig, REFRESH_TOKEN_TTL_DAYS};
use crate::infra::email::EmailSender;

use super::google;
use super::model::{AuthSession, SessionUser, SignUpOutcome};
use super::password::{hash_password, verify_password, MAX_PASSWORD_LEN, MIN_PASSWORD_LEN};
use super::repository;
use super::tokens::{generate_token, hash_token};

const PURPOSE_CONFIRM_EMAIL: &str = "confirm_email";
const PURPOSE_RESET_PASSWORD: &str = "reset_password";
const CONFIRM_TOKEN_TTL_HOURS: i64 = 48;
const RESET_TOKEN_TTL_HOURS: i64 = 2;

/// Dummy hash verified when the user does not exist (uniform timing).
fn dummy_hash() -> String {
    static DUMMY_HASH: std::sync::OnceLock<String> = std::sync::OnceLock::new();
    DUMMY_HASH
        .get_or_init(|| hash_password("timing-equalizer-password").unwrap_or_default())
        .clone()
}

#[derive(Debug)]
pub enum AuthFlowError {
    InvalidCredentials,
    EmailNotConfirmed,
    /// Account exists but has no usable password (migrated from Supabase or
    /// OAuth-only): user must reset the password or sign in with Google.
    PasswordResetRequired,
    EmailAlreadyRegistered,
    InvalidEmail,
    PasswordTooShort,
    /// Invalid or expired one-time token (confirmation, reset, refresh).
    InvalidToken,
    OAuthNotConfigured,
    OAuthFailed(String),
    Db(sqlx::Error),
    Internal(String),
}

impl From<sqlx::Error> for AuthFlowError {
    fn from(e: sqlx::Error) -> Self {
        AuthFlowError::Db(e)
    }
}

/// Dependencies shared by all auth flows.
pub struct AuthContext<'a> {
    pub pool: &'a PgPool,
    pub signer: &'a JwtSigner,
    pub email: &'a dyn EmailSender,
    pub app_public_url: &'a str,
    pub require_email_confirmation: bool,
}

pub struct SignUpInput {
    pub email: String,
    pub password: String,
    pub username: Option<String>,
    pub full_name: Option<String>,
}

fn is_valid_email(email: &str) -> bool {
    let email = email.trim();
    if email.len() < 3 || email.len() > 320 || email.contains(char::is_whitespace) {
        return false;
    }
    let Some((local, domain)) = email.rsplit_once('@') else {
        return false;
    };
    !local.is_empty() && domain.contains('.') && !domain.starts_with('.') && !domain.ends_with('.')
}

fn validate_password(password: &str) -> Result<(), AuthFlowError> {
    if password.len() < MIN_PASSWORD_LEN {
        return Err(AuthFlowError::PasswordTooShort);
    }
    if password.len() > MAX_PASSWORD_LEN {
        return Err(AuthFlowError::InvalidCredentials);
    }
    Ok(())
}

async fn hash_password_blocking(password: String) -> Result<String, AuthFlowError> {
    tokio::task::spawn_blocking(move || hash_password(&password))
        .await
        .map_err(|e| AuthFlowError::Internal(format!("hash task failed: {e}")))?
        .map_err(AuthFlowError::Internal)
}

async fn verify_password_blocking(password: String, hash: String) -> bool {
    tokio::task::spawn_blocking(move || verify_password(&password, &hash))
        .await
        .unwrap_or(false)
}

/// Issues an access + refresh token pair for the user.
pub async fn issue_session(
    pool: &PgPool,
    signer: &JwtSigner,
    user_id: Uuid,
    email: Option<&str>,
) -> Result<AuthSession, AuthFlowError> {
    let (access_token, expires_in) = signer
        .sign(user_id, email)
        .map_err(|e| AuthFlowError::Internal(e.to_string()))?;

    let refresh_token = generate_token();
    repository::insert_refresh_token(
        pool,
        user_id,
        &hash_token(&refresh_token),
        REFRESH_TOKEN_TTL_DAYS,
    )
    .await?;

    Ok(AuthSession {
        access_token,
        refresh_token,
        expires_in,
        token_type: "bearer".to_string(),
        user: SessionUser {
            id: user_id,
            email: email.map(str::to_string),
        },
    })
}

pub async fn sign_in(
    ctx: &AuthContext<'_>,
    email: &str,
    password: &str,
) -> Result<AuthSession, AuthFlowError> {
    let user = repository::find_user_by_email(ctx.pool, email.trim()).await?;

    let Some(user) = user else {
        // Equalize timing with the found-user path.
        verify_password_blocking(password.to_string(), dummy_hash()).await;
        return Err(AuthFlowError::InvalidCredentials);
    };

    let Some(password_hash) = user.password_hash.clone() else {
        return Err(AuthFlowError::PasswordResetRequired);
    };

    if !verify_password_blocking(password.to_string(), password_hash).await {
        return Err(AuthFlowError::InvalidCredentials);
    }

    if ctx.require_email_confirmation && user.email_verified_at.is_none() {
        return Err(AuthFlowError::EmailNotConfirmed);
    }

    issue_session(ctx.pool, ctx.signer, user.id, user.email.as_deref()).await
}

pub async fn sign_up(
    ctx: &AuthContext<'_>,
    input: SignUpInput,
) -> Result<SignUpOutcome, AuthFlowError> {
    let email = input.email.trim().to_lowercase();
    if !is_valid_email(&email) {
        return Err(AuthFlowError::InvalidEmail);
    }
    validate_password(&input.password)?;

    if repository::find_user_by_email(ctx.pool, &email)
        .await?
        .is_some()
    {
        return Err(AuthFlowError::EmailAlreadyRegistered);
    }

    let password_hash = hash_password_blocking(input.password).await?;

    let user = match repository::insert_user(
        ctx.pool,
        &email,
        Some(&password_hash),
        !ctx.require_email_confirmation,
    )
    .await
    {
        Ok(user) => user,
        Err(sqlx::Error::Database(db)) if db.code().as_deref() == Some("23505") => {
            return Err(AuthFlowError::EmailAlreadyRegistered);
        }
        Err(e) => return Err(e.into()),
    };

    let desired_username = input
        .username
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .or(input
            .full_name
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty()));
    repository::insert_profile_for_user(ctx.pool, user.id, desired_username).await?;

    if ctx.require_email_confirmation {
        send_confirmation_email(ctx, user.id, &email).await?;
        return Ok(SignUpOutcome::PendingConfirmation {
            user_id: user.id,
            email,
        });
    }

    let session = issue_session(ctx.pool, ctx.signer, user.id, Some(&email)).await?;
    Ok(SignUpOutcome::Session(session))
}

pub async fn refresh(
    ctx: &AuthContext<'_>,
    refresh_token: &str,
) -> Result<AuthSession, AuthFlowError> {
    let user_id = repository::consume_refresh_token(ctx.pool, &hash_token(refresh_token))
        .await?
        .ok_or(AuthFlowError::InvalidToken)?;

    let user = repository::find_user_by_id(ctx.pool, user_id)
        .await?
        .ok_or(AuthFlowError::InvalidToken)?;

    issue_session(ctx.pool, ctx.signer, user.id, user.email.as_deref()).await
}

pub async fn sign_out(pool: &PgPool, refresh_token: &str) -> Result<(), AuthFlowError> {
    repository::revoke_refresh_token(pool, &hash_token(refresh_token)).await?;
    Ok(())
}

pub async fn confirm_email(ctx: &AuthContext<'_>, token: &str) -> Result<(), AuthFlowError> {
    let user_id = repository::consume_email_token(ctx.pool, PURPOSE_CONFIRM_EMAIL, &hash_token(token))
        .await?
        .ok_or(AuthFlowError::InvalidToken)?;
    repository::set_email_verified(ctx.pool, user_id).await?;
    Ok(())
}

/// Always succeeds for unknown emails (anti-enumeration).
pub async fn forgot_password(ctx: &AuthContext<'_>, email: &str) -> Result<(), AuthFlowError> {
    let Some(user) = repository::find_user_by_email(ctx.pool, email.trim()).await? else {
        return Ok(());
    };
    let Some(user_email) = user.email.clone() else {
        return Ok(());
    };

    let token = generate_token();
    repository::insert_email_token(
        ctx.pool,
        user.id,
        PURPOSE_RESET_PASSWORD,
        &hash_token(&token),
        RESET_TOKEN_TTL_HOURS,
    )
    .await?;

    let link = format!("{}/reset-password?token={token}", ctx.app_public_url);
    let text = format!(
        "Olá!\n\nRecebemos um pedido para redefinir a senha da sua conta Cosmolog.\n\nAbra este link para criar uma nova senha (válido por {RESET_TOKEN_TTL_HOURS} horas):\n{link}\n\nSe você não pediu isso, ignore este email.\n\n— Cosmolog"
    );
    let html = format!(
        "<p>Olá!</p><p>Recebemos um pedido para redefinir a senha da sua conta <strong>Cosmolog</strong>.</p><p><a href=\"{link}\">Criar nova senha</a> (válido por {RESET_TOKEN_TTL_HOURS} horas)</p><p>Se você não pediu isso, ignore este email.</p><p>— Cosmolog</p>"
    );

    ctx.email
        .send(&user_email, "Redefinir senha — Cosmolog", &text, &html)
        .await
        .map_err(AuthFlowError::Internal)?;

    tracing::info!(
        event = "auth.password_reset_requested",
        user_id = %user.id,
        "password reset email sent"
    );
    Ok(())
}

pub async fn reset_password(
    ctx: &AuthContext<'_>,
    token: &str,
    new_password: &str,
) -> Result<AuthSession, AuthFlowError> {
    validate_password(new_password)?;

    let user_id =
        repository::consume_email_token(ctx.pool, PURPOSE_RESET_PASSWORD, &hash_token(token))
            .await?
            .ok_or(AuthFlowError::InvalidToken)?;

    let password_hash = hash_password_blocking(new_password.to_string()).await?;
    repository::set_password(ctx.pool, user_id, &password_hash).await?;
    // Completing the reset proves ownership of the email inbox.
    repository::set_email_verified(ctx.pool, user_id).await?;

    let user = repository::find_user_by_id(ctx.pool, user_id)
        .await?
        .ok_or(AuthFlowError::InvalidToken)?;

    tracing::info!(
        event = "auth.password_reset_completed",
        user_id = %user_id,
        "password reset completed"
    );

    issue_session(ctx.pool, ctx.signer, user.id, user.email.as_deref()).await
}

pub async fn send_confirmation_email(
    ctx: &AuthContext<'_>,
    user_id: Uuid,
    email: &str,
) -> Result<(), AuthFlowError> {
    let token = generate_token();
    repository::insert_email_token(
        ctx.pool,
        user_id,
        PURPOSE_CONFIRM_EMAIL,
        &hash_token(&token),
        CONFIRM_TOKEN_TTL_HOURS,
    )
    .await?;

    let link = format!("{}/api/auth/confirm?token={token}", ctx.app_public_url);
    let text = format!(
        "Bem-vindo(a) ao Cosmolog!\n\nConfirme seu email abrindo este link (válido por {CONFIRM_TOKEN_TTL_HOURS} horas):\n{link}\n\nSe você não criou esta conta, ignore este email.\n\n— Cosmolog"
    );
    let html = format!(
        "<p>Bem-vindo(a) ao <strong>Cosmolog</strong>!</p><p><a href=\"{link}\">Confirmar meu email</a> (válido por {CONFIRM_TOKEN_TTL_HOURS} horas)</p><p>Se você não criou esta conta, ignore este email.</p><p>— Cosmolog</p>"
    );

    ctx.email
        .send(email, "Confirme seu email — Cosmolog", &text, &html)
        .await
        .map_err(AuthFlowError::Internal)?;
    Ok(())
}

/// Google OAuth: exchanges the code, then signs in, links or creates the user.
pub async fn oauth_google(
    ctx: &AuthContext<'_>,
    google_config: Option<&GoogleOAuthConfig>,
    http: &reqwest::Client,
    code: &str,
    code_verifier: &str,
    redirect_uri: &str,
) -> Result<AuthSession, AuthFlowError> {
    let google_config = google_config.ok_or(AuthFlowError::OAuthNotConfigured)?;

    let claims = google::exchange_code(http, google_config, code, code_verifier, redirect_uri)
        .await
        .map_err(AuthFlowError::OAuthFailed)?;

    // 1. Existing linked identity.
    if let Some(user_id) = repository::find_oauth_user(ctx.pool, "google", &claims.sub).await? {
        let user = repository::find_user_by_id(ctx.pool, user_id)
            .await?
            .ok_or_else(|| AuthFlowError::Internal("oauth account without user".into()))?;
        if claims.email_verified {
            repository::set_email_verified(ctx.pool, user.id).await?;
        }
        return issue_session(ctx.pool, ctx.signer, user.id, user.email.as_deref()).await;
    }

    let email = claims
        .email
        .as_deref()
        .map(str::to_lowercase)
        .filter(|e| is_valid_email(e))
        .ok_or_else(|| AuthFlowError::OAuthFailed("google account has no email".into()))?;

    // 2. Link to an existing account only when Google verified the email.
    if let Some(existing) = repository::find_user_by_email(ctx.pool, &email).await? {
        if !claims.email_verified {
            return Err(AuthFlowError::OAuthFailed(
                "google email not verified; cannot link account".into(),
            ));
        }
        repository::insert_oauth_account(ctx.pool, "google", &claims.sub, existing.id, Some(&email))
            .await?;
        repository::set_email_verified(ctx.pool, existing.id).await?;
        tracing::info!(
            event = "auth.oauth_linked",
            user_id = %existing.id,
            provider = "google",
            "linked google identity to existing account"
        );
        return issue_session(ctx.pool, ctx.signer, existing.id, existing.email.as_deref()).await;
    }

    // 3. Brand new user.
    let user = repository::insert_user(ctx.pool, &email, None, claims.email_verified).await?;
    repository::insert_profile_for_user(ctx.pool, user.id, claims.name.as_deref()).await?;
    repository::insert_oauth_account(ctx.pool, "google", &claims.sub, user.id, Some(&email))
        .await?;
    tracing::info!(
        event = "auth.oauth_signup",
        user_id = %user.id,
        provider = "google",
        "created account via google oauth"
    );
    issue_session(ctx.pool, ctx.signer, user.id, user.email.as_deref()).await
}

#[cfg(test)]
mod tests {
    use super::is_valid_email;

    #[test]
    fn accepts_common_emails() {
        assert!(is_valid_email("ana@example.com"));
        assert!(is_valid_email("a.b+tag@sub.domain.co"));
    }

    #[test]
    fn rejects_invalid_emails() {
        assert!(!is_valid_email(""));
        assert!(!is_valid_email("no-at-sign"));
        assert!(!is_valid_email("a@b"));
        assert!(!is_valid_email("a b@c.com"));
        assert!(!is_valid_email("a@.com"));
        assert!(!is_valid_email("a@domain."));
    }
}
