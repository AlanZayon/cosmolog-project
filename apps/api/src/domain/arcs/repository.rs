use sqlx::PgPool;
use uuid::Uuid;

use super::model::Arc;

pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<Arc>, sqlx::Error> {
    sqlx::query_as::<_, Arc>(
        r#"
        SELECT id, universe_id, name, description, type, cover_image_url, created_at
        FROM arcs WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn insert(
    pool: &PgPool,
    universe_id: Uuid,
    name: &str,
    description: Option<&str>,
    arc_type: &str,
    cover_image_url: Option<&str>,
) -> Result<Arc, sqlx::Error> {
    sqlx::query_as::<_, Arc>(
        r#"
        INSERT INTO arcs (universe_id, name, description, type, cover_image_url)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, universe_id, name, description, type, cover_image_url, created_at
        "#,
    )
    .bind(universe_id)
    .bind(name)
    .bind(description)
    .bind(arc_type)
    .bind(cover_image_url)
    .fetch_one(pool)
    .await
}

pub async fn update(
    pool: &PgPool,
    id: Uuid,
    name: &str,
    description: Option<&str>,
    arc_type: &str,
    cover_image_url: Option<&str>,
) -> Result<Arc, sqlx::Error> {
    sqlx::query_as::<_, Arc>(
        r#"
        UPDATE arcs
        SET name = $2, description = $3, type = $4, cover_image_url = $5
        WHERE id = $1
        RETURNING id, universe_id, name, description, type, cover_image_url, created_at
        "#,
    )
    .bind(id)
    .bind(name)
    .bind(description)
    .bind(arc_type)
    .bind(cover_image_url)
    .fetch_one(pool)
    .await
}

pub async fn delete_by_id(pool: &PgPool, id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM arcs WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn list_by_universe_id(pool: &PgPool, universe_id: Uuid) -> Result<Vec<Arc>, sqlx::Error> {
    sqlx::query_as::<_, Arc>(
        r#"
        SELECT id, universe_id, name, description, type, cover_image_url, created_at
        FROM arcs
        WHERE universe_id = $1
        ORDER BY created_at ASC
        "#,
    )
    .bind(universe_id)
    .fetch_all(pool)
    .await
}
