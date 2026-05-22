use sqlx::PgPool;
use uuid::Uuid;

pub async fn has_follow(
    pool: &PgPool,
    universe_id: Uuid,
    user_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM universe_follows WHERE universe_id = $1 AND user_id = $2",
    )
    .bind(universe_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;
    Ok(count > 0)
}

pub async fn insert_follow(
    pool: &PgPool,
    universe_id: Uuid,
    user_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO universe_follows (universe_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    )
    .bind(universe_id)
    .bind(user_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn delete_follow(
    pool: &PgPool,
    universe_id: Uuid,
    user_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM universe_follows WHERE universe_id = $1 AND user_id = $2")
        .bind(universe_id)
        .bind(user_id)
        .execute(pool)
        .await?;
    Ok(())
}
