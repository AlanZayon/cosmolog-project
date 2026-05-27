use sqlx::PgPool;
use uuid::Uuid;

use super::model::CommentWithAuthor;

pub async fn list_by_story_id(
    pool: &PgPool,
    story_id: Uuid,
    viewer_id: Option<Uuid>,
) -> Result<Vec<CommentWithAuthor>, sqlx::Error> {
    sqlx::query_as::<_, CommentWithAuthor>(
        r#"
        SELECT
            c.id,
            c.story_id,
            c.user_id,
            c.content,
            c.created_at,
            c.parent_id,
            c.likes_count,
            ($2::uuid IS NOT NULL AND cl.user_id IS NOT NULL) AS liked,
            p.username
        FROM comments c
        LEFT JOIN profiles p ON p.user_id = c.user_id
        LEFT JOIN comment_likes cl
            ON cl.comment_id = c.id AND cl.user_id = $2
        WHERE c.story_id = $1
        ORDER BY c.created_at DESC
        "#,
    )
    .bind(story_id)
    .bind(viewer_id)
    .fetch_all(pool)
    .await
}

pub async fn find_by_id(
    pool: &PgPool,
    comment_id: Uuid,
) -> Result<Option<(Uuid, Option<Uuid>)>, sqlx::Error> {
    let row: Option<(Uuid, Option<Uuid>)> = sqlx::query_as(
        "SELECT story_id, parent_id FROM comments WHERE id = $1",
    )
    .bind(comment_id)
    .fetch_optional(pool)
    .await?;
    Ok(row)
}

pub async fn resolve_thread_root(
    pool: &PgPool,
    comment_id: Uuid,
) -> Result<Option<Uuid>, sqlx::Error> {
    let mut current = comment_id;
    loop {
        let row: Option<(Option<Uuid>,)> =
            sqlx::query_as("SELECT parent_id FROM comments WHERE id = $1")
                .bind(current)
                .fetch_optional(pool)
                .await?;
        let Some((parent_id,)) = row else {
            return Ok(None);
        };
        match parent_id {
            None => return Ok(Some(current)),
            Some(parent) => current = parent,
        }
    }
}

pub async fn insert(
    pool: &PgPool,
    story_id: Uuid,
    user_id: Uuid,
    content: &str,
    parent_id: Option<Uuid>,
) -> Result<CommentWithAuthor, sqlx::Error> {
    sqlx::query_as::<_, CommentWithAuthor>(
        r#"
        WITH inserted AS (
            INSERT INTO comments (story_id, user_id, content, parent_id)
            VALUES ($1, $2, $3, $4)
            RETURNING id, story_id, user_id, content, created_at, parent_id, likes_count
        )
        SELECT
            i.id,
            i.story_id,
            i.user_id,
            i.content,
            i.created_at,
            i.parent_id,
            i.likes_count,
            false AS liked,
            p.username
        FROM inserted i
        LEFT JOIN profiles p ON p.user_id = i.user_id
        "#,
    )
    .bind(story_id)
    .bind(user_id)
    .bind(content)
    .bind(parent_id)
    .fetch_one(pool)
    .await
}
