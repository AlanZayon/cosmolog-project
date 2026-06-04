use sqlx::PgPool;
use uuid::Uuid;

pub async fn has_like(pool: &PgPool, comment_id: Uuid, user_id: Uuid) -> Result<bool, sqlx::Error> {
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM comment_likes WHERE comment_id = $1 AND user_id = $2",
    )
    .bind(comment_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;
    Ok(count > 0)
}

pub async fn insert_like(
    pool: &PgPool,
    comment_id: Uuid,
    user_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        "INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    )
    .bind(comment_id)
    .bind(user_id)
    .execute(pool)
    .await?;
    Ok(result.rows_affected() > 0)
}

pub async fn delete_like(
    pool: &PgPool,
    comment_id: Uuid,
    user_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2")
        .bind(comment_id)
        .bind(user_id)
        .execute(pool)
        .await?;
    Ok(())
}
