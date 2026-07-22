mod common;

use cosmolog_api::auth::JwtSigner;
use cosmolog_api::domain::auth::service::{self, AuthContext, SignUpInput};
use cosmolog_api::domain::auth::tokens::{generate_token, hash_token};
use cosmolog_api::domain::auth::{repository, AuthFlowError, SignUpOutcome};
use cosmolog_api::infra::email::LogEmailSender;
use sqlx::PgPool;

use common::TEST_JWT_SECRET;

fn signer() -> JwtSigner {
    JwtSigner::from_secret(TEST_JWT_SECRET.as_bytes())
}

fn ctx<'a>(pool: &'a PgPool, signer: &'a JwtSigner, require_confirmation: bool) -> AuthContext<'a> {
    AuthContext {
        pool,
        signer,
        email: &LogEmailSender,
        app_public_url: "http://localhost:3000",
        require_email_confirmation: require_confirmation,
    }
}

fn sign_up_input(email: &str, username: &str) -> SignUpInput {
    SignUpInput {
        email: email.into(),
        password: "secret-password".into(),
        username: Some(username.into()),
        full_name: None,
    }
}

#[tokio::test]
async fn sign_up_and_sign_in_roundtrip() {
    let Some(pool) = common::db::test_db().await else { return };
    let signer = signer();
    let ctx = ctx(&pool, &signer, false);

    let outcome = service::sign_up(&ctx, sign_up_input("Ana@Example.com", "ana"))
        .await
        .expect("sign up");
    let SignUpOutcome::Session(session) = outcome else {
        panic!("expected session without confirmation requirement");
    };
    assert_eq!(session.user.email.as_deref(), Some("ana@example.com"));
    assert_eq!(session.token_type, "bearer");

    // Profile created like the old Supabase trigger.
    let username = sqlx::query_scalar::<_, String>("SELECT username FROM profiles WHERE user_id = $1")
        .bind(session.user.id)
        .fetch_one(&pool)
        .await
        .expect("profile row");
    assert_eq!(username, "ana");

    // Case-insensitive sign-in with the right password.
    let session2 = service::sign_in(&ctx, "ANA@example.COM", "secret-password")
        .await
        .expect("sign in");
    assert_eq!(session2.user.id, session.user.id);

    // Wrong password fails.
    assert!(matches!(
        service::sign_in(&ctx, "ana@example.com", "wrong").await,
        Err(AuthFlowError::InvalidCredentials)
    ));
}

#[tokio::test]
async fn sign_up_rejects_duplicate_email() {
    let Some(pool) = common::db::test_db().await else { return };
    let signer = signer();
    let ctx = ctx(&pool, &signer, false);

    service::sign_up(&ctx, sign_up_input("dup@example.com", "dup_one"))
        .await
        .expect("first sign up");
    assert!(matches!(
        service::sign_up(&ctx, sign_up_input("dup@example.com", "dup_two")).await,
        Err(AuthFlowError::EmailAlreadyRegistered)
    ));
}

#[tokio::test]
async fn duplicate_username_gets_suffix() {
    let Some(pool) = common::db::test_db().await else { return };
    let signer = signer();
    let ctx = ctx(&pool, &signer, false);

    service::sign_up(&ctx, sign_up_input("first@example.com", "samename"))
        .await
        .expect("first");
    let SignUpOutcome::Session(second) =
        service::sign_up(&ctx, sign_up_input("second@example.com", "samename"))
            .await
            .expect("second")
    else {
        panic!("expected session");
    };

    let username = sqlx::query_scalar::<_, String>("SELECT username FROM profiles WHERE user_id = $1")
        .bind(second.user.id)
        .fetch_one(&pool)
        .await
        .expect("profile row");
    assert_eq!(username, "samename_1");
}

#[tokio::test]
async fn refresh_token_rotates_and_cannot_be_reused() {
    let Some(pool) = common::db::test_db().await else { return };
    let signer = signer();
    let ctx = ctx(&pool, &signer, false);

    let SignUpOutcome::Session(session) =
        service::sign_up(&ctx, sign_up_input("rotate@example.com", "rotate"))
            .await
            .expect("sign up")
    else {
        panic!("expected session");
    };

    let refreshed = service::refresh(&ctx, &session.refresh_token)
        .await
        .expect("refresh");
    assert_eq!(refreshed.user.id, session.user.id);
    assert_ne!(refreshed.refresh_token, session.refresh_token);

    // Old token was rotated out.
    assert!(matches!(
        service::refresh(&ctx, &session.refresh_token).await,
        Err(AuthFlowError::InvalidToken)
    ));

    // Sign-out revokes the new one too.
    service::sign_out(&pool, &refreshed.refresh_token)
        .await
        .expect("sign out");
    assert!(matches!(
        service::refresh(&ctx, &refreshed.refresh_token).await,
        Err(AuthFlowError::InvalidToken)
    ));
}

#[tokio::test]
async fn email_confirmation_flow_gates_sign_in() {
    let Some(pool) = common::db::test_db().await else { return };
    let signer = signer();
    let ctx = ctx(&pool, &signer, true);

    let outcome = service::sign_up(&ctx, sign_up_input("confirm@example.com", "confirm"))
        .await
        .expect("sign up");
    let SignUpOutcome::PendingConfirmation { user_id, .. } = outcome else {
        panic!("expected pending confirmation");
    };

    assert!(matches!(
        service::sign_in(&ctx, "confirm@example.com", "secret-password").await,
        Err(AuthFlowError::EmailNotConfirmed)
    ));

    // Simulate clicking the emailed link (token issued manually here).
    let token = generate_token();
    repository::insert_email_token(&pool, user_id, "confirm_email", &hash_token(&token), 48)
        .await
        .expect("token");
    service::confirm_email(&ctx, &token).await.expect("confirm");

    let session = service::sign_in(&ctx, "confirm@example.com", "secret-password")
        .await
        .expect("sign in after confirm");
    assert_eq!(session.user.id, user_id);

    // Token cannot be reused.
    assert!(matches!(
        service::confirm_email(&ctx, &token).await,
        Err(AuthFlowError::InvalidToken)
    ));
}

#[tokio::test]
async fn password_reset_flow_sets_new_password_and_revokes_sessions() {
    let Some(pool) = common::db::test_db().await else { return };
    let signer = signer();
    let ctx = ctx(&pool, &signer, false);

    let SignUpOutcome::Session(session) =
        service::sign_up(&ctx, sign_up_input("reset@example.com", "reset"))
            .await
            .expect("sign up")
    else {
        panic!("expected session");
    };

    // Unknown email is silently accepted (anti-enumeration).
    service::forgot_password(&ctx, "ghost@example.com")
        .await
        .expect("forgot for unknown email");

    let token = generate_token();
    repository::insert_email_token(
        &pool,
        session.user.id,
        "reset_password",
        &hash_token(&token),
        2,
    )
    .await
    .expect("token");

    let new_session = service::reset_password(&ctx, &token, "brand-new-password")
        .await
        .expect("reset");
    assert_eq!(new_session.user.id, session.user.id);

    // Old refresh token revoked by the reset.
    assert!(matches!(
        service::refresh(&ctx, &session.refresh_token).await,
        Err(AuthFlowError::InvalidToken)
    ));

    // Old password no longer works; new one does.
    assert!(matches!(
        service::sign_in(&ctx, "reset@example.com", "secret-password").await,
        Err(AuthFlowError::InvalidCredentials)
    ));
    service::sign_in(&ctx, "reset@example.com", "brand-new-password")
        .await
        .expect("sign in with new password");
}

#[tokio::test]
async fn migrated_user_without_password_requires_reset() {
    let Some(pool) = common::db::test_db().await else { return };
    let signer = signer();
    let ctx = ctx(&pool, &signer, false);

    // Simulates a user copied from auth.users (password_hash NULL).
    repository::insert_user(&pool, "legacy@example.com", None, true)
        .await
        .expect("insert legacy user");

    assert!(matches!(
        service::sign_in(&ctx, "legacy@example.com", "whatever").await,
        Err(AuthFlowError::PasswordResetRequired)
    ));
}

#[tokio::test]
async fn oauth_account_links_user() {
    let Some(pool) = common::db::test_db().await else { return };

    let user = repository::insert_user(&pool, "google@example.com", None, true)
        .await
        .expect("user");
    repository::insert_oauth_account(&pool, "google", "sub-123", user.id, Some("google@example.com"))
        .await
        .expect("link");

    let found = repository::find_oauth_user(&pool, "google", "sub-123")
        .await
        .expect("query");
    assert_eq!(found, Some(user.id));

    // Idempotent on conflict.
    repository::insert_oauth_account(&pool, "google", "sub-123", user.id, None)
        .await
        .expect("relink");
}
