//! Feature workers — sole writers of Feature Store keys (Phase B).

use feed_contracts::events::EventType;
use feed_contracts::features::FeatureValue;
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

use super::feature_store::MemoryFeatureStore;

pub struct FeatureWorkers {
    store: MemoryFeatureStore,
    pool: PgPool,
}

impl FeatureWorkers {
    pub fn new(pool: PgPool, store: MemoryFeatureStore) -> Self {
        Self { store, pool }
    }

    pub fn store(&self) -> &MemoryFeatureStore {
        &self.store
    }

    /// Process one domain event idempotently via `processed_events`.
    pub async fn handle_event(
        &self,
        event_id: Uuid,
        event_type: &str,
        payload: &Value,
    ) -> Result<bool, String> {
        let inserted = sqlx::query(
            r#"
            INSERT INTO processed_events (event_id, event_type)
            VALUES ($1, $2)
            ON CONFLICT (event_id) DO NOTHING
            "#,
        )
        .bind(event_id)
        .bind(event_type)
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?
        .rows_affected();

        if inserted == 0 {
            return Ok(false); // already processed
        }

        self.apply(event_type, payload).await?;
        Ok(true)
    }

    async fn apply(&self, event_type: &str, payload: &Value) -> Result<(), String> {
        match event_type {
            t if t == EventType::StoryCreated.as_str() => {
                let story_id = payload_uuid(payload, "story_id")?;
                self.store.set_feature(
                    "story",
                    story_id,
                    "story.likes_count",
                    FeatureValue::Int(0),
                );
                self.store.set_feature(
                    "story",
                    story_id,
                    "story.age_hours",
                    FeatureValue::Float(0.0),
                );
                if let Some(universe_id) = payload.get("universe_id").and_then(|v| v.as_str()) {
                    if let Ok(uid) = Uuid::parse_str(universe_id) {
                        self.store
                            .incr_f64("universe", uid, "universe.story_count", 1.0);
                    }
                }
            }
            t if t == EventType::StoryLiked.as_str() => {
                let story_id = payload_uuid(payload, "story_id")?;
                let liked = payload
                    .get("liked")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(true);
                self.store.incr_f64(
                    "story",
                    story_id,
                    "story.likes_count",
                    if liked { 1.0 } else { -1.0 },
                );
            }
            t if t == EventType::StoryUnliked.as_str() => {
                let story_id = payload_uuid(payload, "story_id")?;
                self.store
                    .incr_f64("story", story_id, "story.likes_count", -1.0);
            }
            t if t == EventType::UniverseFollowed.as_str()
                || t == EventType::UniverseUnfollowed.as_str() =>
            {
                let user_id = payload_uuid(payload, "user_id")?;
                let following = payload
                    .get("following")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(true);
                self.store.incr_f64(
                    "user",
                    user_id,
                    "user.follow_count",
                    if following { 1.0 } else { -1.0 },
                );
                let universe_id = payload_uuid(payload, "universe_id")?;
                // Graph index hint for FollowingCandidateSource
                self.store.set_feature(
                    "graph",
                    user_id,
                    &format!("follows:{universe_id}"),
                    FeatureValue::Bool(following),
                );
            }
            _ => {}
        }
        Ok(())
    }
}

fn payload_uuid(payload: &Value, key: &str) -> Result<Uuid, String> {
    payload
        .get(key)
        .and_then(|v| v.as_str())
        .ok_or_else(|| format!("missing {key}"))
        .and_then(|s| Uuid::parse_str(s).map_err(|e| e.to_string()))
}
