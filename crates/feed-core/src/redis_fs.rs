//! Feature Store on Redis (DB 1).

use feed_contracts::features::{FeatureValue, FeatureVector};
use redis::aio::ConnectionManager;
use redis::AsyncCommands;
use uuid::Uuid;

#[derive(Clone)]
pub struct RedisFeatureStore {
    conn: ConnectionManager,
}

impl RedisFeatureStore {
    pub async fn connect(redis_url: &str) -> anyhow::Result<Self> {
        let client = redis::Client::open(redis_url)?;
        let conn = ConnectionManager::new(client).await?;
        Ok(Self { conn })
    }

    fn entity_key(entity: &str, id: Uuid) -> String {
        format!("fs:{entity}:{id}")
    }

    pub async fn set_feature(
        &self,
        entity: &str,
        id: Uuid,
        name: &str,
        value: FeatureValue,
    ) -> anyhow::Result<()> {
        let key = Self::entity_key(entity, id);
        let field = name.to_string();
        let encoded = serde_json::to_string(&value)?;
        let mut conn = self.conn.clone();
        conn.hset::<_, _, _, ()>(key, field, encoded).await?;
        Ok(())
    }

    pub async fn get(&self, entity: &str, id: Uuid) -> anyhow::Result<FeatureVector> {
        let key = Self::entity_key(entity, id);
        let mut conn = self.conn.clone();
        let map: std::collections::HashMap<String, String> = conn.hgetall(key).await?;
        let mut values = std::collections::HashMap::new();
        for (k, v) in map {
            if let Ok(fv) = serde_json::from_str::<FeatureValue>(&v) {
                values.insert(k, fv);
            }
        }
        Ok(FeatureVector { values })
    }

    pub async fn incr_f64(
        &self,
        entity: &str,
        id: Uuid,
        name: &str,
        by: f64,
    ) -> anyhow::Result<()> {
        let current = self.get(entity, id).await?;
        let next = current.get_f64(name).unwrap_or(0.0) + by;
        self.set_feature(entity, id, name, FeatureValue::Float(next))
            .await
    }

    /// Apply a domain event payload to the feature store (idempotency is caller's job).
    pub async fn apply_event(&self, event_type: &str, payload: &serde_json::Value) -> anyhow::Result<()> {
        match event_type {
            "story.created" => {
                let story_id = payload_uuid(payload, "story_id")?;
                self.set_feature("story", story_id, "story.likes_count", FeatureValue::Int(0))
                    .await?;
                self.set_feature("story", story_id, "story.age_hours", FeatureValue::Float(0.0))
                    .await?;
                if let Ok(uid) = payload_uuid(payload, "universe_id") {
                    self.incr_f64("universe", uid, "universe.story_count", 1.0)
                        .await?;
                }
            }
            "story.liked" => {
                let story_id = payload_uuid(payload, "story_id")?;
                let liked = payload.get("liked").and_then(|v| v.as_bool()).unwrap_or(true);
                self.incr_f64(
                    "story",
                    story_id,
                    "story.likes_count",
                    if liked { 1.0 } else { -1.0 },
                )
                .await?;
            }
            "story.unliked" => {
                let story_id = payload_uuid(payload, "story_id")?;
                self.incr_f64("story", story_id, "story.likes_count", -1.0)
                    .await?;
            }
            "universe.followed" | "universe.unfollowed" => {
                let user_id = payload_uuid(payload, "user_id")?;
                let universe_id = payload_uuid(payload, "universe_id")?;
                let following = payload
                    .get("following")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(event_type == "universe.followed");
                self.incr_f64(
                    "user",
                    user_id,
                    "user.follow_count",
                    if following { 1.0 } else { -1.0 },
                )
                .await?;
                self.set_feature(
                    "graph",
                    user_id,
                    &format!("follows:{universe_id}"),
                    FeatureValue::Bool(following),
                )
                .await?;
            }
            _ => {}
        }
        Ok(())
    }
}

fn payload_uuid(payload: &serde_json::Value, key: &str) -> anyhow::Result<Uuid> {
    let v = payload
        .get(key)
        .ok_or_else(|| anyhow::anyhow!("missing {key}"))?;
    if let Some(s) = v.as_str() {
        return Ok(Uuid::parse_str(s)?);
    }
    // Some serializers emit UUID as opaque JSON; reject null/other.
    Err(anyhow::anyhow!("invalid {key}"))
}
