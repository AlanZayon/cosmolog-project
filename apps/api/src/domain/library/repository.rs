use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::likes;
use crate::domain::stories::model::Story;

use super::create::CreateCollectionInput;
use super::model::{
    LibraryCollection, LibraryCollectionSummary, LibraryStatus, LibraryStatusCollection,
};
use super::reorder::ReorderCollectionStoriesInput;
use super::update::UpdateCollectionInput;
use super::visibility::{can_read_collection, VISIBILITY_PRIVATE, VISIBILITY_PUBLIC};

#[derive(Debug, sqlx::FromRow)]
struct LikedStoryRow {
    #[sqlx(flatten)]
    story: Story,
    liked_at: time::OffsetDateTime,
    universe_title: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct CollectionStoryRow {
    #[sqlx(flatten)]
    story: Story,
    library_added_at: time::OffsetDateTime,
    universe_title: Option<String>,
}

#[derive(Debug)]
pub struct LikedStoryMeta {
    pub story: Story,
    pub liked_at: time::OffsetDateTime,
    pub universe_title: Option<String>,
}

#[derive(Debug)]
pub struct CollectionStoryMeta {
    pub story: Story,
    pub library_added_at: time::OffsetDateTime,
    pub universe_title: Option<String>,
}

pub async fn list_liked_stories(pool: &PgPool, user_id: Uuid) -> Result<Vec<LikedStoryMeta>, sqlx::Error> {
    let rows = sqlx::query_as::<_, LikedStoryRow>(
        r#"
        SELECT s.id, s.author_id, s.title, s.description, s.cover_image_url,
               s.feed_display_mode, s.reading_mode, s.content, s.type, s.universe_id, s.arc_id,
               s.tags, s.likes_count, s.comments_count, s.created_at, s.updated_at,
               l.created_at AS liked_at,
               u.title AS universe_title
        FROM stories s
        JOIN likes l ON l.story_id = s.id
        LEFT JOIN universes u ON u.id = s.universe_id
        WHERE l.user_id = $1
        ORDER BY l.created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| LikedStoryMeta {
            story: r.story,
            liked_at: r.liked_at,
            universe_title: r.universe_title,
        })
        .collect())
}

pub async fn list_for_shelf(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Vec<LibraryCollectionSummary>, sqlx::Error> {
    sqlx::query_as::<_, LibraryCollectionSummary>(
        r#"
        SELECT c.id, c.user_id, c.name, c.description, c.icon, c.visibility,
               c.created_at, c.updated_at,
               COUNT(i.story_id)::int AS item_count,
               'owned'::text AS ownership,
               p.username AS owner_username,
               NULL::timestamptz AS saved_at,
               false AS is_saved_by_me
        FROM library_collections c
        LEFT JOIN library_collection_items i ON i.collection_id = c.id
        LEFT JOIN profiles p ON p.user_id = c.user_id
        WHERE c.user_id = $1
        GROUP BY c.id, p.username

        UNION ALL

        SELECT c.id, c.user_id, c.name, c.description, c.icon, c.visibility,
               c.created_at, c.updated_at,
               COUNT(i.story_id)::int AS item_count,
               'saved'::text AS ownership,
               p.username AS owner_username,
               s.saved_at,
               true AS is_saved_by_me
        FROM library_collection_saves s
        JOIN library_collections c ON c.id = s.collection_id AND c.visibility = 'public'
        LEFT JOIN library_collection_items i ON i.collection_id = c.id
        LEFT JOIN profiles p ON p.user_id = c.user_id
        WHERE s.user_id = $1
        GROUP BY c.id, p.username, s.saved_at
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
}

pub async fn search_public(
    pool: &PgPool,
    query: &str,
    viewer_id: Option<Uuid>,
    limit: i64,
) -> Result<Vec<LibraryCollectionSummary>, sqlx::Error> {
    let pattern = format!("%{query}%");
    sqlx::query_as::<_, LibraryCollectionSummary>(
        r#"
        SELECT c.id, c.user_id, c.name, c.description, c.icon, c.visibility,
               c.created_at, c.updated_at,
               COUNT(i.story_id)::int AS item_count,
               'public'::text AS ownership,
               p.username AS owner_username,
               NULL::timestamptz AS saved_at,
               CASE
                 WHEN $2::uuid IS NULL THEN false
                 ELSE EXISTS (
                   SELECT 1 FROM library_collection_saves sv
                   WHERE sv.collection_id = c.id AND sv.user_id = $2
                 )
               END AS is_saved_by_me
        FROM library_collections c
        LEFT JOIN library_collection_items i ON i.collection_id = c.id
        LEFT JOIN profiles p ON p.user_id = c.user_id
        WHERE c.visibility = 'public'
          AND (c.name ILIKE $1 OR COALESCE(c.description, '') ILIKE $1)
        GROUP BY c.id, p.username
        ORDER BY c.updated_at DESC
        LIMIT $3
        "#,
    )
    .bind(pattern)
    .bind(viewer_id)
    .bind(limit)
    .fetch_all(pool)
    .await
}

pub async fn insert(
    pool: &PgPool,
    user_id: Uuid,
    input: &CreateCollectionInput,
    visibility: &str,
) -> Result<LibraryCollection, sqlx::Error> {
    let icon =
        super::icons::resolved_icon(input.icon.as_deref()).unwrap_or(super::icons::DEFAULT_ICON);
    sqlx::query_as::<_, LibraryCollection>(
        r#"
        INSERT INTO library_collections (user_id, name, description, icon, visibility)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, user_id, name, description, icon, visibility, created_at, updated_at
        "#,
    )
    .bind(user_id)
    .bind(input.name())
    .bind(input.description())
    .bind(icon)
    .bind(visibility)
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
    let previous_visibility = collection.visibility.clone();
    let visibility = match &input.visibility {
        Some(v) => v.trim().to_string(),
        None => collection.visibility,
    };

    let mut tx = pool.begin().await?;

    let updated = sqlx::query_as::<_, LibraryCollection>(
        r#"
        UPDATE library_collections SET
            name = $2,
            description = $3,
            icon = $4,
            visibility = $5,
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, user_id, name, description, icon, visibility, created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(&name)
    .bind(&description)
    .bind(&icon)
    .bind(&visibility)
    .fetch_one(&mut *tx)
    .await?;

    if visibility == VISIBILITY_PRIVATE && previous_visibility == VISIBILITY_PUBLIC {
        sqlx::query("DELETE FROM library_collection_saves WHERE collection_id = $1")
            .bind(id)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;
    Ok(updated)
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

pub async fn find_summary_for_viewer(
    pool: &PgPool,
    id: Uuid,
    viewer_id: Uuid,
) -> Result<LibraryCollectionSummary, sqlx::Error> {
    let collection = find_by_id(pool, id).await?;
    let Some(collection) = collection else {
        return Err(sqlx::Error::RowNotFound);
    };
    if !can_read_collection(collection.user_id, &collection.visibility, viewer_id) {
        return Err(sqlx::Error::RowNotFound);
    }

    let is_saved = is_saved(pool, id, viewer_id).await?;
    let ownership = if collection.user_id == viewer_id {
        "owned".to_string()
    } else if is_saved {
        "saved".to_string()
    } else {
        "public".to_string()
    };

    sqlx::query_as::<_, LibraryCollectionSummary>(
        r#"
        SELECT c.id, c.user_id, c.name, c.description, c.icon, c.visibility,
               c.created_at, c.updated_at,
               COUNT(i.story_id)::int AS item_count,
               $2::text AS ownership,
               p.username AS owner_username,
               s.saved_at,
               $3 AS is_saved_by_me
        FROM library_collections c
        LEFT JOIN library_collection_items i ON i.collection_id = c.id
        LEFT JOIN profiles p ON p.user_id = c.user_id
        LEFT JOIN library_collection_saves s
          ON s.collection_id = c.id AND s.user_id = $4
        WHERE c.id = $1
        GROUP BY c.id, p.username, s.saved_at
        "#,
    )
    .bind(id)
    .bind(&ownership)
    .bind(is_saved)
    .bind(viewer_id)
    .fetch_one(pool)
    .await
}

pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<LibraryCollection>, sqlx::Error> {
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
    viewer_id: Uuid,
) -> Result<Vec<CollectionStoryMeta>, sqlx::Error> {
    let collection = find_by_id(pool, collection_id).await?;
    let Some(collection) = collection else {
        return Err(sqlx::Error::RowNotFound);
    };
    if !can_read_collection(collection.user_id, &collection.visibility, viewer_id) {
        return Err(sqlx::Error::RowNotFound);
    }

    let rows = sqlx::query_as::<_, CollectionStoryRow>(
        r#"
        SELECT s.id, s.author_id, s.title, s.description, s.cover_image_url,
               s.feed_display_mode, s.reading_mode, s.content, s.type, s.universe_id, s.arc_id,
               s.tags, s.likes_count, s.comments_count, s.created_at, s.updated_at,
               i.added_at AS library_added_at,
               u.title AS universe_title
        FROM stories s
        JOIN library_collection_items i ON i.story_id = s.id
        LEFT JOIN universes u ON u.id = s.universe_id
        WHERE i.collection_id = $1
        ORDER BY i.position ASC NULLS LAST, i.added_at DESC
        "#,
    )
    .bind(collection_id)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| CollectionStoryMeta {
            story: r.story,
            library_added_at: r.library_added_at,
            universe_title: r.universe_title,
        })
        .collect())
}

pub async fn save_collection(
    pool: &PgPool,
    collection_id: Uuid,
    user_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let collection = find_by_id(pool, collection_id).await?;
    let Some(collection) = collection else {
        return Err(sqlx::Error::RowNotFound);
    };
    if collection.user_id == user_id {
        return Err(sqlx::Error::RowNotFound);
    }
    if collection.visibility != VISIBILITY_PUBLIC {
        return Err(sqlx::Error::RowNotFound);
    }

    let result = sqlx::query(
        r#"
        INSERT INTO library_collection_saves (user_id, collection_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(user_id)
    .bind(collection_id)
    .execute(pool)
    .await?;
    Ok(result.rows_affected() > 0)
}

pub async fn unsave_collection(
    pool: &PgPool,
    collection_id: Uuid,
    user_id: Uuid,
) -> Result<(), sqlx::Error> {
    let result = sqlx::query(
        "DELETE FROM library_collection_saves WHERE user_id = $1 AND collection_id = $2",
    )
    .bind(user_id)
    .bind(collection_id)
    .execute(pool)
    .await?;
    if result.rows_affected() == 0 {
        return Err(sqlx::Error::RowNotFound);
    }
    Ok(())
}

pub async fn is_saved(pool: &PgPool, collection_id: Uuid, user_id: Uuid) -> Result<bool, sqlx::Error> {
    let exists: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS (
          SELECT 1 FROM library_collection_saves
          WHERE user_id = $1 AND collection_id = $2
        )
        "#,
    )
    .bind(user_id)
    .bind(collection_id)
    .fetch_one(pool)
    .await?;
    Ok(exists)
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

    sqlx::query("UPDATE library_collections SET updated_at = NOW() WHERE id = $1")
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

    sqlx::query("DELETE FROM library_collection_items WHERE collection_id = $1 AND story_id = $2")
        .bind(collection_id)
        .bind(story_id)
        .execute(pool)
        .await?;

    sqlx::query("UPDATE library_collections SET updated_at = NOW() WHERE id = $1")
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

    sqlx::query("UPDATE library_collections SET updated_at = NOW() WHERE id = $1")
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
        .map(
            |(id, name, icon, description, contains_story)| LibraryStatusCollection {
                id,
                name,
                icon,
                description,
                contains_story,
            },
        )
        .collect();

    Ok(LibraryStatus { liked, collections })
}
