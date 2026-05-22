use sqlx::PgPool;
use uuid::Uuid;

use super::model::Chapter;

pub async fn list_by_story_id(pool: &PgPool, story_id: Uuid) -> Result<Vec<Chapter>, sqlx::Error> {
    sqlx::query_as::<_, Chapter>(
        r#"
        SELECT id, story_id, title, content, chapter_number, created_at, updated_at
        FROM chapters
        WHERE story_id = $1
        ORDER BY chapter_number ASC
        "#,
    )
    .bind(story_id)
    .fetch_all(pool)
    .await
}

pub async fn count_by_story_id(pool: &PgPool, story_id: Uuid) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar::<_, i64>("SELECT COUNT(*)::bigint FROM chapters WHERE story_id = $1")
        .bind(story_id)
        .fetch_one(pool)
        .await
}

pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<Chapter>, sqlx::Error> {
    sqlx::query_as::<_, Chapter>(
        r#"
        SELECT id, story_id, title, content, chapter_number, created_at, updated_at
        FROM chapters WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn find_by_story_and_number(
    pool: &PgPool,
    story_id: Uuid,
    chapter_number: i32,
) -> Result<Option<Chapter>, sqlx::Error> {
    sqlx::query_as::<_, Chapter>(
        r#"
        SELECT id, story_id, title, content, chapter_number, created_at, updated_at
        FROM chapters
        WHERE story_id = $1 AND chapter_number = $2
        "#,
    )
    .bind(story_id)
    .bind(chapter_number)
    .fetch_optional(pool)
    .await
}

pub async fn insert(
    pool: &PgPool,
    story_id: Uuid,
    title: &str,
    chapter_number: i32,
) -> Result<Chapter, sqlx::Error> {
    sqlx::query_as::<_, Chapter>(
        r#"
        INSERT INTO chapters (story_id, title, content, chapter_number)
        VALUES ($1, $2, '', $3)
        RETURNING id, story_id, title, content, chapter_number, created_at, updated_at
        "#,
    )
    .bind(story_id)
    .bind(title)
    .bind(chapter_number)
    .fetch_one(pool)
    .await
}

pub async fn update_title(
    pool: &PgPool,
    chapter_id: Uuid,
    title: &str,
) -> Result<Chapter, sqlx::Error> {
    sqlx::query_as::<_, Chapter>(
        r#"
        UPDATE chapters SET title = $2, content = '', updated_at = NOW()
        WHERE id = $1
        RETURNING id, story_id, title, content, chapter_number, created_at, updated_at
        "#,
    )
    .bind(chapter_id)
    .bind(title)
    .fetch_one(pool)
    .await
}
