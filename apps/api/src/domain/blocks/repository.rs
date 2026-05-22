use sqlx::PgPool;
use uuid::Uuid;

use super::model::{BlockInput, IllustratedBlock};

pub async fn list_for_story(
    pool: &PgPool,
    story_id: Uuid,
    chapter_id: Option<Uuid>,
) -> Result<Vec<IllustratedBlock>, sqlx::Error> {
    match chapter_id {
        Some(cid) => {
            sqlx::query_as::<_, IllustratedBlock>(
                r#"
                SELECT id, story_id, chapter_id, block_type, content, block_order, created_at
                FROM illustrated_blocks
                WHERE story_id = $1 AND chapter_id = $2
                ORDER BY block_order ASC
                "#,
            )
            .bind(story_id)
            .bind(cid)
            .fetch_all(pool)
            .await
        }
        None => {
            sqlx::query_as::<_, IllustratedBlock>(
                r#"
                SELECT id, story_id, chapter_id, block_type, content, block_order, created_at
                FROM illustrated_blocks
                WHERE story_id = $1 AND chapter_id IS NULL
                ORDER BY block_order ASC
                "#,
            )
            .bind(story_id)
            .fetch_all(pool)
            .await
        }
    }
}

pub async fn replace_for_story(
    pool: &PgPool,
    story_id: Uuid,
    chapter_id: Option<Uuid>,
    blocks: &[BlockInput],
) -> Result<Vec<IllustratedBlock>, sqlx::Error> {
    let mut tx = pool.begin().await?;
    match chapter_id {
        Some(cid) => {
            sqlx::query(
                "DELETE FROM illustrated_blocks WHERE story_id = $1 AND chapter_id = $2",
            )
            .bind(story_id)
            .bind(cid)
            .execute(&mut *tx)
            .await?;
        }
        None => {
            sqlx::query(
                "DELETE FROM illustrated_blocks WHERE story_id = $1 AND chapter_id IS NULL",
            )
            .bind(story_id)
            .execute(&mut *tx)
            .await?;
        }
    }

    let mut out = Vec::new();
    for (i, block) in blocks.iter().enumerate() {
        if block.content.trim().is_empty() {
            continue;
        }
        let row = sqlx::query_as::<_, IllustratedBlock>(
            r#"
            INSERT INTO illustrated_blocks (story_id, chapter_id, block_type, content, block_order)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, story_id, chapter_id, block_type, content, block_order, created_at
            "#,
        )
        .bind(story_id)
        .bind(chapter_id)
        .bind(&block.block_type)
        .bind(block.content.trim())
        .bind((i + 1) as i32)
        .fetch_one(&mut *tx)
        .await?;
        out.push(row);
    }
    tx.commit().await?;
    Ok(out)
}
