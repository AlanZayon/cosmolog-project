use sqlx::{Executor, PgPool, Postgres};
use uuid::Uuid;

pub async fn has_like(pool: &PgPool, story_id: Uuid, user_id: Uuid) -> Result<bool, sqlx::Error> {
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM likes WHERE story_id = $1 AND user_id = $2",
    )
    .bind(story_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;
    Ok(count > 0)
}

pub async fn insert_like<'e, E>(
    executor: E,
    story_id: Uuid,
    user_id: Uuid,
) -> Result<(), sqlx::Error>
where
    E: Executor<'e, Database = Postgres>,
{
    sqlx::query("INSERT INTO likes (story_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING")
        .bind(story_id)
        .bind(user_id)
        .execute(executor)
        .await?;
    Ok(())
}

pub async fn delete_like<'e, E>(
    executor: E,
    story_id: Uuid,
    user_id: Uuid,
) -> Result<(), sqlx::Error>
where
    E: Executor<'e, Database = Postgres>,
{
    sqlx::query("DELETE FROM likes WHERE story_id = $1 AND user_id = $2")
        .bind(story_id)
        .bind(user_id)
        .execute(executor)
        .await?;
    Ok(())
}
