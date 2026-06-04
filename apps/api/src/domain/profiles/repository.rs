use sqlx::PgPool;
use uuid::Uuid;

use super::model::Profile;
use super::update::ValidatedUpdate;

pub async fn find_by_user_id(pool: &PgPool, user_id: Uuid) -> Result<Option<Profile>, sqlx::Error> {
    sqlx::query_as::<_, Profile>(
        r#"
        SELECT id, user_id, username, avatar_url, bio, created_at, updated_at
        FROM profiles
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
}

pub async fn find_by_user_ids(
    pool: &PgPool,
    user_ids: &[Uuid],
) -> Result<Vec<Profile>, sqlx::Error> {
    if user_ids.is_empty() {
        return Ok(vec![]);
    }

    sqlx::query_as::<_, Profile>(
        r#"
        SELECT id, user_id, username, avatar_url, bio, created_at, updated_at
        FROM profiles
        WHERE user_id = ANY($1)
        "#,
    )
    .bind(user_ids)
    .fetch_all(pool)
    .await
}

pub async fn search_by_username(
    pool: &PgPool,
    query: &str,
    limit: i64,
) -> Result<Vec<Profile>, sqlx::Error> {
    let pattern = format!("%{query}%");
    sqlx::query_as::<_, Profile>(
        r#"
        SELECT id, user_id, username, avatar_url, bio, created_at, updated_at
        FROM profiles
        WHERE username ILIKE $1
        ORDER BY username ASC
        LIMIT $2
        "#,
    )
    .bind(pattern)
    .bind(limit)
    .fetch_all(pool)
    .await
}

pub async fn find_by_username(
    pool: &PgPool,
    username: &str,
) -> Result<Option<Profile>, sqlx::Error> {
    sqlx::query_as::<_, Profile>(
        r#"
        SELECT id, user_id, username, avatar_url, bio, created_at, updated_at
        FROM profiles
        WHERE username = $1
        "#,
    )
    .bind(username)
    .fetch_optional(pool)
    .await
}

/// Case-insensitive username lookup (for @mentions in comments).
pub async fn find_by_username_ci(
    pool: &PgPool,
    username: &str,
) -> Result<Option<Profile>, sqlx::Error> {
    sqlx::query_as::<_, Profile>(
        r#"
        SELECT id, user_id, username, avatar_url, bio, created_at, updated_at
        FROM profiles
        WHERE lower(username) = lower($1)
        "#,
    )
    .bind(username)
    .fetch_optional(pool)
    .await
}

pub async fn update_by_user_id(
    pool: &PgPool,
    user_id: Uuid,
    input: &ValidatedUpdate,
) -> Result<Option<Profile>, sqlx::Error> {
    let current = find_by_user_id(pool, user_id).await?;
    let Some(current) = current else {
        return Ok(None);
    };

    let username = input.username.as_ref().unwrap_or(&current.username);
    let bio = input
        .bio
        .as_ref()
        .or(current.bio.as_ref())
        .map(|s| s.as_str())
        .unwrap_or("");
    let avatar_url = match &input.avatar_url {
        Some(value) => value.as_deref(),
        None => current.avatar_url.as_deref(),
    };

    sqlx::query_as::<_, Profile>(
        r#"
        UPDATE profiles
        SET
            username = $2,
            bio = $3,
            avatar_url = $4,
            updated_at = now()
        WHERE user_id = $1
        RETURNING id, user_id, username, avatar_url, bio, created_at, updated_at
        "#,
    )
    .bind(user_id)
    .bind(username)
    .bind(bio)
    .bind(avatar_url)
    .fetch_optional(pool)
    .await
}
