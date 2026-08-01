use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};

use async_trait::async_trait;
use feed_contracts::gateway::{FeedGateway, FeedQuery, FeedResponseItem, FeedSourceMode};
use feed_contracts::ids::ItemId;
use feed_contracts::policy::{FilterDecision, PolicyClient};
use feed_core::RedisTimelineStore;
use serde_json::Value;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use super::materializer::TimelineMaterializer;
use super::ranking::sticky_arm;

/// Home feed gateway with sql | shadow | canary | engine modes.
pub struct SqlFeedGateway {
    pool: PgPool,
    policy: Arc<dyn PolicyClient>,
    mode: FeedSourceMode,
    materializer: TimelineMaterializer,
    /// Redis feed-serving (DB2). Preferred for engine/canary when present.
    redis_timelines: Option<RedisTimelineStore>,
    /// Soft budget for SQL fallback under canary/engine miss (process-local).
    fallback_count: AtomicU64,
    fallback_budget_per_window: u64,
}

impl SqlFeedGateway {
    pub fn new(
        pool: PgPool,
        policy: Arc<dyn PolicyClient>,
        mode: FeedSourceMode,
        materializer: TimelineMaterializer,
    ) -> Self {
        Self::with_redis(pool, policy, mode, materializer, None)
    }

    pub fn with_redis(
        pool: PgPool,
        policy: Arc<dyn PolicyClient>,
        mode: FeedSourceMode,
        materializer: TimelineMaterializer,
        redis_timelines: Option<RedisTimelineStore>,
    ) -> Self {
        Self {
            pool,
            policy,
            mode,
            materializer,
            redis_timelines,
            fallback_count: AtomicU64::new(0),
            fallback_budget_per_window: 200,
        }
    }

    async fn fetch_sql(
        &self,
        limit: i32,
        viewer_id: Option<Uuid>,
    ) -> Result<Vec<FeedResponseItem>, String> {
        let rows = sqlx::query(
            "SELECT id, type, payload, ranking_score FROM public.get_feed($1, $2)",
        )
        .bind(limit)
        .bind(viewer_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(rows
            .into_iter()
            .map(|row| FeedResponseItem {
                id: row.get::<Uuid, _>("id"),
                item_type: row.get::<String, _>("type"),
                payload: row.get::<Value, _>("payload"),
                ranking_score: row.get::<f64, _>("ranking_score"),
            })
            .collect())
    }

    async fn apply_policy(
        &self,
        viewer: Option<feed_contracts::ids::ViewerId>,
        mut items: Vec<FeedResponseItem>,
    ) -> Vec<FeedResponseItem> {
        let ids: Vec<ItemId> = items.iter().map(|i| ItemId(i.id)).collect();
        let decisions = self.policy.evaluate(viewer, &ids).await;
        let drop_ids: std::collections::HashSet<Uuid> = decisions
            .iter()
            .filter(|d| d.decision == FilterDecision::Drop)
            .map(|d| d.item_id.0)
            .collect();
        if !drop_ids.is_empty() {
            items.retain(|i| !drop_ids.contains(&i.id));
        }
        items
    }

    fn try_memory_materialized(
        &self,
        viewer_id: Uuid,
        limit: usize,
    ) -> Option<Vec<FeedResponseItem>> {
        let timeline = self.materializer.read_timeline(viewer_id, limit);
        if timeline.is_empty() {
            return None;
        }
        let mut items = Vec::new();
        for (id, score) in timeline {
            let payload = self
                .materializer
                .get_payload(id)
                .unwrap_or_else(|| serde_json::json!({ "id": id }));
            items.push(FeedResponseItem {
                id,
                item_type: "story".into(),
                payload,
                ranking_score: score,
            });
        }
        Some(items)
    }

    async fn try_redis_materialized(
        &self,
        viewer_id: Uuid,
        limit: usize,
    ) -> Option<Vec<FeedResponseItem>> {
        let store = self.redis_timelines.as_ref()?;
        let rows = store
            .read_timeline(viewer_id, limit as isize)
            .await
            .ok()?;
        if rows.is_empty() {
            tracing::info!(
                event = "feed.gateway.miss",
                user_id = %viewer_id,
                "redis timeline empty"
            );
            return None;
        }
        match feed_core::hydrate_feed_items(&self.pool, store, &rows).await {
            Ok(items) => {
                tracing::info!(
                    event = "feed.gateway.hit",
                    user_id = %viewer_id,
                    count = items.len(),
                    "served from redis timeline"
                );
                Some(items)
            }
            Err(e) => {
                tracing::warn!(
                    event = "feed.gateway.hydrate_error",
                    error = %e,
                    "hydrate failed"
                );
                None
            }
        }
    }
}

#[async_trait]
impl FeedGateway for SqlFeedGateway {
    fn mode(&self) -> FeedSourceMode {
        self.mode
    }

    async fn get_home_feed(&self, query: FeedQuery) -> Result<Vec<FeedResponseItem>, String> {
        let limit = query.limit.clamp(1, 100);
        let viewer_uuid = query.viewer_id.map(|v| v.0);

        let sql_items = self.fetch_sql(limit, viewer_uuid).await?;

        match self.mode {
            FeedSourceMode::Sql => Ok(self.apply_policy(query.viewer_id, sql_items).await),
            FeedSourceMode::Shadow => {
                if let Some(uid) = viewer_uuid {
                    let engine_items = if let Some(items) =
                        self.try_redis_materialized(uid, limit as usize).await
                    {
                        Some(items)
                    } else {
                        self.try_memory_materialized(uid, limit as usize)
                    };
                    if let Some(engine_items) = engine_items {
                        let sql_ids: Vec<_> = sql_items.iter().map(|i| i.id).collect();
                        let eng_ids: Vec<_> = engine_items.iter().map(|i| i.id).collect();
                        let agreement = if sql_ids.is_empty() {
                            1.0
                        } else {
                            let overlap = sql_ids.iter().filter(|id| eng_ids.contains(id)).count();
                            overlap as f64 / sql_ids.len() as f64
                        };
                        tracing::info!(
                            event = "feed.shadow.diff",
                            user_id = %uid,
                            agreement = agreement,
                            arm = %sticky_arm(Some(uid), "feed_source", &["shadow"]),
                            "shadow ranking comparison (clients still on SQL)"
                        );
                    }
                }
                Ok(self.apply_policy(query.viewer_id, sql_items).await)
            }
            FeedSourceMode::Canary | FeedSourceMode::Engine => {
                let in_canary = match viewer_uuid {
                    Some(uid) => {
                        sticky_arm(Some(uid), "feed_canary", &["sql", "engine"]) == "engine"
                    }
                    None => false,
                };
                if matches!(self.mode, FeedSourceMode::Engine) || in_canary {
                    if let Some(uid) = viewer_uuid {
                        if let Some(items) =
                            self.try_redis_materialized(uid, limit as usize).await
                        {
                            return Ok(self.apply_policy(query.viewer_id, items).await);
                        }
                        if let Some(items) = self.try_memory_materialized(uid, limit as usize) {
                            return Ok(self.apply_policy(query.viewer_id, items).await);
                        }
                        let used = self.fallback_count.fetch_add(1, Ordering::Relaxed);
                        if used >= self.fallback_budget_per_window {
                            tracing::warn!(
                                event = "feed.fallback.budget_exceeded",
                                "SQL fallback budget exceeded; serving empty/degraded"
                            );
                            return Ok(vec![]);
                        }
                        tracing::info!(
                            event = "feed.fallback.sql",
                            user_id = %uid,
                            "engine miss — SQL fallback"
                        );
                    }
                }
                Ok(self.apply_policy(query.viewer_id, sql_items).await)
            }
        }
    }
}
