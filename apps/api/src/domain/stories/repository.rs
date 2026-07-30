use sqlx::PgPool;
use sqlx::{Executor, Postgres};
use uuid::Uuid;

use super::create::CreateStoryInput;
use super::model::Story;
use super::update::UpdateStoryInput;

const STORY_COLUMNS: &str = r#"
    id, author_id, title, description, cover_image_url, feed_display_mode, reading_mode, content,
    type, universe_id, arc_id, tags, likes_count, comments_count,
    created_at, updated_at
"#;

pub async fn insert<'e, E>(
    executor: E,
    author_id: Uuid,
    input: &CreateStoryInput,
) -> Result<Story, sqlx::Error>
where
    E: Executor<'e, Database = Postgres>,
{
    sqlx::query_as::<_, Story>(
        r#"
        INSERT INTO stories (
            title, description, author_id, tags, type, content,
            universe_id, arc_id, cover_image_url, feed_display_mode, reading_mode
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING
            id, author_id, title, description, cover_image_url, feed_display_mode, reading_mode, content,
            type, universe_id, arc_id, tags, likes_count, comments_count,
            created_at, updated_at
        "#,
    )
    .bind(input.title())
    .bind(input.description())
    .bind(author_id)
    .bind(input.tags.as_ref())
    .bind(&input.r#type)
    .bind(input.content.as_deref())
    .bind(input.universe_id)
    .bind(input.arc_id)
    .bind(input.cover_image_url.as_deref())
    .bind(input.feed_display_mode())
    .bind(input.reading_mode())
    .fetch_one(executor)
    .await
}

pub async fn list_by_author_id(pool: &PgPool, author_id: Uuid) -> Result<Vec<Story>, sqlx::Error> {
    sqlx::query_as::<_, Story>(&format!(
        r#"
        SELECT {STORY_COLUMNS}
        FROM stories
        WHERE author_id = $1
        ORDER BY created_at DESC
        "#
    ))
    .bind(author_id)
    .fetch_all(pool)
    .await
}

pub async fn list_by_universe_id(
    pool: &PgPool,
    universe_id: Uuid,
    story_type: Option<&str>,
) -> Result<Vec<Story>, sqlx::Error> {
    match story_type {
        Some(kind) => {
            sqlx::query_as::<_, Story>(&format!(
                r#"
                SELECT {STORY_COLUMNS}
                FROM stories
                WHERE universe_id = $1 AND type = $2
                ORDER BY created_at ASC
                "#
            ))
            .bind(universe_id)
            .bind(kind)
            .fetch_all(pool)
            .await
        }
        None => {
            sqlx::query_as::<_, Story>(&format!(
                r#"
                SELECT {STORY_COLUMNS}
                FROM stories
                WHERE universe_id = $1
                ORDER BY created_at ASC
                "#
            ))
            .bind(universe_id)
            .fetch_all(pool)
            .await
        }
    }
}

pub async fn search_by_title(
    pool: &PgPool,
    query: &str,
    limit: i64,
) -> Result<Vec<Story>, sqlx::Error> {
    let pattern = format!("%{query}%");
    sqlx::query_as::<_, Story>(&format!(
        r#"
        SELECT {STORY_COLUMNS}
        FROM stories
        WHERE title ILIKE $1
        ORDER BY likes_count DESC
        LIMIT $2
        "#
    ))
    .bind(pattern)
    .bind(limit)
    .fetch_all(pool)
    .await
}

pub async fn list_by_arc_id(pool: &PgPool, arc_id: Uuid) -> Result<Vec<Story>, sqlx::Error> {
    sqlx::query_as::<_, Story>(&format!(
        r#"
        SELECT {STORY_COLUMNS}
        FROM stories
        WHERE arc_id = $1
        ORDER BY created_at DESC
        "#
    ))
    .bind(arc_id)
    .fetch_all(pool)
    .await
}

pub async fn update(
    pool: &PgPool,
    id: Uuid,
    author_id: Uuid,
    input: &UpdateStoryInput,
) -> Result<Story, sqlx::Error> {
    let existing = find_by_id(pool, id).await?;
    let Some(story) = existing else {
        return Err(sqlx::Error::RowNotFound);
    };
    if story.author_id != author_id {
        return Err(sqlx::Error::RowNotFound);
    }

    let title = input
        .title
        .as_ref()
        .map(|s| s.trim().to_string())
        .unwrap_or(story.title);
    let description = match &input.description {
        Some(d) => Some(d.trim().to_string()).filter(|s| !s.is_empty()),
        None => story.description,
    };
    let tags = input.tags.clone().or(story.tags);
    let story_type = input.r#type.clone().unwrap_or(story.r#type);
    let universe_id = input.universe_id.unwrap_or(story.universe_id);
    let arc_id = input.arc_id.unwrap_or(story.arc_id);
    let cover_image_url = input
        .cover_image_url
        .clone()
        .unwrap_or(story.cover_image_url);
    let feed_display_mode = input
        .feed_display_mode
        .clone()
        .unwrap_or(story.feed_display_mode);
    let reading_mode = if story_type != "comic" {
        "vertical".to_string()
    } else {
        input
            .reading_mode
            .clone()
            .unwrap_or(story.reading_mode)
    };
    let content = input.content.clone().unwrap_or(story.content);

    sqlx::query_as::<_, Story>(
        r#"
        UPDATE stories SET
            title = $2,
            description = $3,
            tags = $4,
            type = $5,
            universe_id = $6,
            arc_id = $7,
            cover_image_url = $8,
            feed_display_mode = $9,
            reading_mode = $10,
            content = $11,
            updated_at = NOW()
        WHERE id = $1
        RETURNING
            id, author_id, title, description, cover_image_url, feed_display_mode, reading_mode, content,
            type, universe_id, arc_id, tags, likes_count, comments_count,
            created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(title)
    .bind(description)
    .bind(tags)
    .bind(story_type)
    .bind(universe_id)
    .bind(arc_id)
    .bind(cover_image_url)
    .bind(feed_display_mode)
    .bind(reading_mode)
    .bind(content)
    .fetch_one(pool)
    .await
}

pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<Story>, sqlx::Error> {
    sqlx::query_as::<_, Story>(&format!(
        r#"
        SELECT {STORY_COLUMNS}
        FROM stories
        WHERE id = $1
        "#
    ))
    .bind(id)
    .fetch_optional(pool)
    .await
}
