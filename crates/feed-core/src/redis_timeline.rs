//! Feed serving timelines on Redis (DB 2).

use redis::aio::ConnectionManager;
use redis::AsyncCommands;
use uuid::Uuid;

use crate::ranking::ScoredItem;

#[derive(Clone)]
pub struct RedisTimelineStore {
    conn: ConnectionManager,
}

impl RedisTimelineStore {
    pub async fn connect(redis_url: &str) -> anyhow::Result<Self> {
        let client = redis::Client::open(redis_url)?;
        let conn = ConnectionManager::new(client).await?;
        Ok(Self { conn })
    }

    fn timeline_key(user_id: Uuid) -> String {
        format!("feed:user:{user_id}")
    }

    fn payload_key(item_type: &str, id: Uuid) -> String {
        format!("payload:item:{item_type}:{id}")
    }

    pub async fn write_timeline(&self, user_id: Uuid, scored: &[ScoredItem]) -> anyhow::Result<()> {
        let key = Self::timeline_key(user_id);
        let mut conn = self.conn.clone();
        let _: () = redis::cmd("DEL").arg(&key).query_async(&mut conn).await?;
        for item in scored.iter().take(500) {
            let member = format!("{}:{}", item_type_str(item.candidate.item_type), item.candidate.id);
            let _: () = conn.zadd(&key, member, item.score).await?;
        }
        let _: () = conn.expire(&key, 86_400).await?;
        tracing::info!(
            event = "feed.materializer.write",
            user_id = %user_id,
            count = scored.len().min(500),
            "wrote user timeline"
        );
        Ok(())
    }

    pub async fn put_payload(
        &self,
        item_type: &str,
        id: Uuid,
        payload: serde_json::Value,
    ) -> anyhow::Result<()> {
        let key = Self::payload_key(item_type, id);
        let mut conn = self.conn.clone();
        let _: () = conn.set_ex(key, payload.to_string(), 3600).await?;
        Ok(())
    }

    pub async fn get_payload(
        &self,
        item_type: &str,
        id: Uuid,
    ) -> anyhow::Result<Option<serde_json::Value>> {
        let key = Self::payload_key(item_type, id);
        let mut conn = self.conn.clone();
        let raw: Option<String> = conn.get(key).await?;
        Ok(raw.and_then(|s| serde_json::from_str(&s).ok()))
    }

    /// Returns (item_type, id, score) desc.
    pub async fn read_timeline(
        &self,
        user_id: Uuid,
        limit: isize,
    ) -> anyhow::Result<Vec<(String, Uuid, f64)>> {
        let key = Self::timeline_key(user_id);
        let mut conn = self.conn.clone();
        let rows: Vec<(String, f64)> = conn.zrevrange_withscores(key, 0, limit - 1).await?;
        let mut out = Vec::new();
        for (member, score) in rows {
            if let Some((ty, id_str)) = member.split_once(':') {
                if let Ok(id) = Uuid::parse_str(id_str) {
                    out.push((ty.to_string(), id, score));
                }
            }
        }
        Ok(out)
    }
}

fn item_type_str(t: feed_contracts::candidates::ItemType) -> &'static str {
    match t {
        feed_contracts::candidates::ItemType::Story => "story",
        feed_contracts::candidates::ItemType::Arc => "arc",
        feed_contracts::candidates::ItemType::Universe => "universe",
    }
}
