//! Hydrate story payloads to match `get_feed` story JSON shape (simplified but UI-compatible).

use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

/// Returns payloads keyed by story id, preserving as much of the get_feed story payload as practical.
pub async fn hydrate_story_payloads(
    pool: &PgPool,
    story_ids: &[Uuid],
) -> anyhow::Result<Vec<(Uuid, Value)>> {
    if story_ids.is_empty() {
        return Ok(vec![]);
    }

    // Fetch stories with author profile + optional universe/arc.
    let rows = sqlx::query_as::<_, StoryHydrateRow>(
        r#"
        SELECT
            s.id,
            s.title,
            s.description,
            s.type AS story_type,
            s.cover_image_url,
            s.feed_display_mode,
            s.reading_mode,
            s.likes_count,
            s.comments_count,
            s.content,
            s.author_id AS author_user_id,
            p.username AS author_username,
            p.avatar_url AS author_avatar_url,
            u.id AS universe_id,
            u.title AS universe_title,
            u.cover_image_url AS universe_cover,
            a.id AS arc_id,
            a.name AS arc_name,
            a.type AS arc_type
        FROM stories s
        LEFT JOIN profiles p ON p.user_id = s.author_id
        LEFT JOIN universes u ON u.id = s.universe_id
        LEFT JOIN arcs a ON a.id = s.arc_id
        WHERE s.id = ANY($1)
        "#,
    )
    .bind(story_ids)
    .fetch_all(pool)
    .await?;

    let mut by_id: std::collections::HashMap<Uuid, Value> = std::collections::HashMap::new();
    for r in rows {
        let preview_text = r
            .content
            .as_deref()
            .or(r.description.as_deref())
            .unwrap_or("")
            .chars()
            .take(320)
            .collect::<String>();
        let payload = json!({
            "id": r.id,
            "title": r.title,
            "description": r.description,
            "storyType": r.story_type,
            "coverImageUrl": r.cover_image_url,
            "feedDisplayMode": r.feed_display_mode,
            "readingMode": r.reading_mode,
            "previewImageUrls": [],
            "author": {
                "id": r.author_user_id,
                "username": r.author_username,
                "avatarUrl": r.author_avatar_url
            },
            "universe": r.universe_id.map(|id| json!({
                "id": id,
                "title": r.universe_title,
                "coverImageUrl": r.universe_cover
            })),
            "arc": r.arc_id.map(|id| json!({
                "id": id,
                "name": r.arc_name,
                "type": r.arc_type
            })),
            "preview": {
                "kind": "text",
                "text": preview_text,
                "imageUrl": r.cover_image_url
            },
            "stats": {
                "likes": r.likes_count,
                "comments": r.comments_count
            }
        });
        by_id.insert(r.id, payload);
    }

    // Preserve request order
    let mut out = Vec::new();
    for id in story_ids {
        if let Some(p) = by_id.remove(id) {
            out.push((*id, p));
        }
    }
    Ok(out)
}

/// Build feed response items from timeline rows + cached/hydrated payloads.
pub async fn hydrate_feed_items(
    pool: &PgPool,
    timelines: &crate::redis_timeline::RedisTimelineStore,
    rows: &[(String, Uuid, f64)],
) -> anyhow::Result<Vec<feed_contracts::gateway::FeedResponseItem>> {
    let mut items = Vec::new();
    let mut missing_stories = Vec::new();

    for (ty, id, score) in rows {
        if let Some(payload) = timelines.get_payload(ty, *id).await? {
            items.push(feed_contracts::gateway::FeedResponseItem {
                id: *id,
                item_type: ty.clone(),
                payload,
                ranking_score: *score,
            });
        } else if ty == "story" {
            missing_stories.push(*id);
            items.push(feed_contracts::gateway::FeedResponseItem {
                id: *id,
                item_type: ty.clone(),
                payload: json!({ "id": id }),
                ranking_score: *score,
            });
        }
    }

    if !missing_stories.is_empty() {
        let hydrated = hydrate_story_payloads(pool, &missing_stories).await?;
        let map: std::collections::HashMap<_, _> = hydrated.into_iter().collect();
        for item in &mut items {
            if let Some(p) = map.get(&item.id) {
                item.payload = p.clone();
                let _ = timelines.put_payload("story", item.id, p.clone()).await;
            }
        }
    }

    Ok(items)
}

#[derive(Debug, sqlx::FromRow)]
struct StoryHydrateRow {
    id: Uuid,
    title: String,
    description: Option<String>,
    story_type: String,
    cover_image_url: Option<String>,
    feed_display_mode: String,
    reading_mode: String,
    likes_count: i32,
    comments_count: i32,
    content: Option<String>,
    author_user_id: Uuid,
    author_username: Option<String>,
    author_avatar_url: Option<String>,
    universe_id: Option<Uuid>,
    universe_title: Option<String>,
    universe_cover: Option<String>,
    arc_id: Option<Uuid>,
    arc_name: Option<String>,
    arc_type: Option<String>,
}
