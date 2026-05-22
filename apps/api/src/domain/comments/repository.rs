use sqlx::PgPool;
use uuid::Uuid;

use super::model::CommentWithAuthor;

pub async fn list_by_story_id(
    pool: &PgPool,
    story_id: Uuid,
) -> Result<Vec<CommentWithAuthor>, sqlx::Error> {
    sqlx::query_as::<_, CommentWithAuthor>(
        r#"
        SELECT
            c.id, c.story_id, c.user_id, c.content, c.created_at,
            p.username
        FROM comments c
        LEFT JOIN profiles p ON p.user_id = c.user_id
        WHERE c.story_id = $1
        ORDER BY c.created_at DESC
        "#,
    )
    .bind(story_id)
    .fetch_all(pool)
    .await
}

pub async fn insert(
    pool: &PgPool,
    story_id: Uuid,
    user_id: Uuid,
    content: &str,
) -> Result<CommentWithAuthor, sqlx::Error> {
    sqlx::query_as::<_, CommentWithAuthor>(
        r#"
        WITH inserted AS (
            INSERT INTO comments (story_id, user_id, content)
            VALUES ($1, $2, $3)
            RETURNING id, story_id, user_id, content, created_at
        )
        SELECT i.id, i.story_id, i.user_id, i.content, i.created_at, p.username
        FROM inserted i
        LEFT JOIN profiles p ON p.user_id = i.user_id
        "#,
    )
    .bind(story_id)
    .bind(user_id)
    .bind(content)
    .fetch_one(pool)
    .await
}
