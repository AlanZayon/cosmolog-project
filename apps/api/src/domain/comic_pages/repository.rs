use sqlx::PgPool;
use uuid::Uuid;

use super::model::ComicPage;

pub async fn list_by_story_id(
    pool: &PgPool,
    story_id: Uuid,
) -> Result<Vec<ComicPage>, sqlx::Error> {
    sqlx::query_as::<_, ComicPage>(
        r#"
        SELECT id, story_id, image_url, page_order, created_at
        FROM comic_pages
        WHERE story_id = $1
        ORDER BY page_order ASC
        "#,
    )
    .bind(story_id)
    .fetch_all(pool)
    .await
}

pub async fn replace_for_story(
    pool: &PgPool,
    story_id: Uuid,
    pages: &[(String, i32)],
) -> Result<Vec<ComicPage>, sqlx::Error> {
    let mut tx = pool.begin().await?;
    sqlx::query("DELETE FROM comic_pages WHERE story_id = $1")
        .bind(story_id)
        .execute(&mut *tx)
        .await?;

    let mut out = Vec::new();
    for (image_url, page_order) in pages {
        let row = sqlx::query_as::<_, ComicPage>(
            r#"
            INSERT INTO comic_pages (story_id, image_url, page_order)
            VALUES ($1, $2, $3)
            RETURNING id, story_id, image_url, page_order, created_at
            "#,
        )
        .bind(story_id)
        .bind(image_url)
        .bind(page_order)
        .fetch_one(&mut *tx)
        .await?;
        out.push(row);
    }
    tx.commit().await?;
    Ok(out)
}
