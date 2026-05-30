use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::likes;
use crate::domain::stories::model::Story;

use super::create::CreateCollectionInput;
use super::model::{LibraryCollection, LibraryCollectionSummary, LibraryStatus, LibraryStatusCollection};
use super::reorder::ReorderCollectionStoriesInput;
use super::update::UpdateCollectionInput;

pub async fn list_liked_stories(pool: &PgPool, user_id: Uuid) -> Result<Vec<Story>, sqlx::Error> {
    sqlx::query_as::<_, Story>(
        r#"
        SELECT s.id, s.author_id, s.title, s.description, s.cover_image_url,
               s.feed_display_mode, s.content, s.type, s.universe_id, s.arc_id,
               s.tags, s.likes_count, s.comments_count, s.created_at, s.updated_at
        FROM stories s
        JOIN likes l ON l.story_id = s.id
        WHERE l.user_id = $1
        ORDER BY l.created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
}

pub async fn list_by_user_id(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Vec<LibraryCollectionSummary>, sqlx::Error> {
    sqlx::query_as::<_, LibraryCollectionSummary>(
        r#"
        SELECT c.id, c.user_id, c.name, c.description, c.icon, c.visibility,
               c.created_at, c.updated_at,
               COUNT(i.story_id)::int AS item_count
        FROM library_collections c
        LEFT JOIN library_collection_items i ON i.collection_id = c.id
        WHERE c.user_id = $1
        GROUP BY c.id
        ORDER BY c.updated_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
}

pub async fn insert(
    pool: &PgPool,
    user_id: Uuid,
    input: &CreateCollectionInput,
) -> Result<LibraryCollection, sqlx::Error> {
    let icon = super::icons::resolved_icon(input.icon.as_deref())
        .unwrap_or(super::icons::DEFAULT_ICON);
    sqlx::query_as::<_, LibraryCollection>(
        r#"
        INSERT INTO library_collections (user_id, name, description, icon)
        VALUES ($1, $2, $3, $4)
        RETURNING id, user_id, name, description, icon, visibility, created_at, updated_at
        "#,
    )
    .bind(user_id)
    .bind(input.name())
    .bind(input.description())
    .bind(icon)
    .fetch_one(pool)
    .await
}

pub async fn update(
    pool: &PgPool,
    id: Uuid,
    user_id: Uuid,
    input: &UpdateCollectionInput,
) -> Result<LibraryCollection, sqlx::Error> {
    let existing = find_by_id(pool, id).await?;
    let Some(collection) = existing else {
        return Err(sqlx::Error::RowNotFound);
    };
    if collection.user_id != user_id {
        return Err(sqlx::Error::RowNotFound);
    }

    let name = input
        .name
        .as_ref()
        .map(|s| s.trim().to_string())
        .unwrap_or(collection.name);
    let description = match &input.description {
        Some(d) => Some(d.trim().to_string()).filter(|s| !s.is_empty()),
        None => collection.description,
    };
    let icon = input
        .icon
        .as_ref()
        .map(|s| s.trim().to_string())
        .unwrap_or(collection.icon);

    sqlx::query_as::<_, LibraryCollection>(
        r#"
        UPDATE library_collections SET
            name = $2,
            description = $3,
            icon = $4,
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, user_id, name, description, icon, visibility, created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(name)
    .bind(description)
    .bind(icon)
    .fetch_one(pool)
    .await
}

pub async fn delete(pool: &PgPool, id: Uuid, user_id: Uuid) -> Result<(), sqlx::Error> {
    let existing = find_by_id(pool, id).await?;
    let Some(collection) = existing else {
        return Err(sqlx::Error::RowNotFound);
    };
    if collection.user_id != user_id {
        return Err(sqlx::Error::RowNotFound);
    }

    sqlx::query("DELETE FROM library_collections WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn find_by_id(
    pool: &PgPool,
    id: Uuid,
) -> Result<Option<LibraryCollection>, sqlx::Error> {
    sqlx::query_as::<_, LibraryCollection>(
        r#"
        SELECT id, user_id, name, description, icon, visibility, created_at, updated_at
        FROM library_collections
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn list_stories_in_collection(
    pool: &PgPool,
    collection_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<Story>, sqlx::Error> {
    let collection = find_by_id(pool, collection_id).await?;
    let Some(collection) = collection else {
        return Err(sqlx::Error::RowNotFound);
    };
    if collection.user_id != user_id {
        return Err(sqlx::Error::RowNotFound);
    }

    sqlx::query_as::<_, Story>(
        r#"
        SELECT s.id, s.author_id, s.title, s.description, s.cover_image_url,
               s.feed_display_mode, s.content, s.type, s.universe_id, s.arc_id,
               s.tags, s.likes_count, s.comments_count, s.created_at, s.updated_at
        FROM stories s
        JOIN library_collection_items i ON i.story_id = s.id
        WHERE i.collection_id = $1
        ORDER BY i.position ASC NULLS LAST, i.added_at DESC
        "#,
    )
    .bind(collection_id)
    .fetch_all(pool)
    .await
}

pub async fn insert_item(
    pool: &PgPool,
    collection_id: Uuid,
    story_id: Uuid,
    user_id: Uuid,
) -> Result<(), sqlx::Error> {
    let collection = find_by_id(pool, collection_id).await?;
    let Some(collection) = collection else {
        return Err(sqlx::Error::RowNotFound);
    };
    if collection.user_id != user_id {
        return Err(sqlx::Error::RowNotFound);
    }

    sqlx::query(
        r#"
        INSERT INTO library_collection_items (collection_id, story_id, position)
        SELECT $1, $2, COALESCE(MAX(position), -1) + 1
        FROM library_collection_items
        WHERE collection_id = $1
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(collection_id)
    .bind(story_id)
    .execute(pool)
    .await?;

    sqlx::query(
        "UPDATE library_collections SET updated_at = NOW() WHERE id = $1",
    )
    .bind(collection_id)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn delete_item(
    pool: &PgPool,
    collection_id: Uuid,
    story_id: Uuid,
    user_id: Uuid,
) -> Result<(), sqlx::Error> {
    let collection = find_by_id(pool, collection_id).await?;
    let Some(collection) = collection else {
        return Err(sqlx::Error::RowNotFound);
    };
    if collection.user_id != user_id {
        return Err(sqlx::Error::RowNotFound);
    }

    sqlx::query(
        "DELETE FROM library_collection_items WHERE collection_id = $1 AND story_id = $2",
    )
    .bind(collection_id)
    .bind(story_id)
    .execute(pool)
    .await?;

    sqlx::query(
        "UPDATE library_collections SET updated_at = NOW() WHERE id = $1",
    )
    .bind(collection_id)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn reorder_stories(
    pool: &PgPool,
    collection_id: Uuid,
    user_id: Uuid,
    input: &ReorderCollectionStoriesInput,
) -> Result<(), sqlx::Error> {
    let collection = find_by_id(pool, collection_id).await?;
    let Some(collection) = collection else {
        return Err(sqlx::Error::RowNotFound);
    };
    if collection.user_id != user_id {
        return Err(sqlx::Error::RowNotFound);
    }

    let existing: Vec<Uuid> = sqlx::query_scalar(
        "SELECT story_id FROM library_collection_items WHERE collection_id = $1",
    )
    .bind(collection_id)
    .fetch_all(pool)
    .await?;

    if existing.len() != input.story_ids.len() {
        return Err(sqlx::Error::RowNotFound);
    }

    let existing_set: std::collections::HashSet<Uuid> = existing.into_iter().collect();
    if input.story_ids.len() != existing_set.len()
        || !input.story_ids.iter().all(|id| existing_set.contains(id))
    {
        return Err(sqlx::Error::RowNotFound);
    }

    let mut tx = pool.begin().await?;
    for (position, story_id) in input.story_ids.iter().enumerate() {
        sqlx::query(
            "UPDATE library_collection_items SET position = $3 WHERE collection_id = $1 AND story_id = $2",
        )
        .bind(collection_id)
        .bind(story_id)
        .bind(position as i32)
        .execute(&mut *tx)
        .await?;
    }

    sqlx::query(
        "UPDATE library_collections SET updated_at = NOW() WHERE id = $1",
    )
    .bind(collection_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

pub async fn library_status(
    pool: &PgPool,
    story_id: Uuid,
    user_id: Uuid,
) -> Result<LibraryStatus, sqlx::Error> {
    let liked = likes::has_like(pool, story_id, user_id).await?;

    let rows: Vec<(Uuid, String, String, Option<String>, bool)> = sqlx::query_as(
        r#"
        SELECT c.id, c.name, c.icon, c.description,
               EXISTS (
                 SELECT 1 FROM library_collection_items i
                 WHERE i.collection_id = c.id AND i.story_id = $2
               ) AS contains_story
        FROM library_collections c
        WHERE c.user_id = $1
        ORDER BY c.updated_at DESC
        "#,
    )
    .bind(user_id)
    .bind(story_id)
    .fetch_all(pool)
    .await?;

    let collections = rows
        .into_iter()
        .map(|(id, name, icon, description, contains_story)| LibraryStatusCollection {
            id,
            name,
            icon,
            description,
            contains_story,
        })
        .collect();

    Ok(LibraryStatus { liked, collections })
}
