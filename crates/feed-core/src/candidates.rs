//! Candidate sources for feed-rank.

use async_trait::async_trait;
use feed_contracts::candidates::{
    Candidate, CandidateBatch, CandidateSource, ItemType, RetrievalContext, SourceId,
};
use sqlx::PgPool;
use time::OffsetDateTime;
use uuid::Uuid;

use crate::redis_fs::RedisFeatureStore;

pub struct RecentCandidateSource {
    pub pool: PgPool,
}

#[async_trait]
impl CandidateSource for RecentCandidateSource {
    fn name(&self) -> SourceId {
        SourceId("recent".into())
    }

    async fn fetch(&self, ctx: &RetrievalContext) -> CandidateBatch {
        let limit = ctx.limit_per_source as i64;
        let rows: Vec<(Uuid, OffsetDateTime)> = sqlx::query_as(
            r#"
            SELECT id, created_at FROM stories
            ORDER BY created_at DESC
            LIMIT $1
            "#,
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .unwrap_or_default();

        let now = OffsetDateTime::now_utc();
        CandidateBatch {
            source: "recent".into(),
            items: rows
                .into_iter()
                .map(|(id, created)| {
                    let age = (now - created).whole_seconds().max(0) as f64;
                    Candidate {
                        id,
                        item_type: ItemType::Story,
                        reasons: vec!["recent".into()],
                        rough_score: 1_000_000.0 - age,
                    }
                })
                .collect(),
        }
    }
}

pub struct PopularityCandidateSource {
    pub store: RedisFeatureStore,
    pub pool: PgPool,
}

#[async_trait]
impl CandidateSource for PopularityCandidateSource {
    fn name(&self) -> SourceId {
        SourceId("popular".into())
    }

    async fn fetch(&self, ctx: &RetrievalContext) -> CandidateBatch {
        let limit = ctx.limit_per_source as i64;
        let rows: Vec<(Uuid, i32)> = sqlx::query_as(
            r#"
            SELECT id, likes_count FROM stories
            ORDER BY likes_count DESC, created_at DESC
            LIMIT $1
            "#,
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .unwrap_or_default();

        let mut items = Vec::new();
        for (id, likes) in rows {
            let fs = self.store.get("story", id).await.unwrap_or_default();
            let fs_likes = fs.get_f64("story.likes_count").unwrap_or(likes as f64);
            items.push(Candidate {
                id,
                item_type: ItemType::Story,
                reasons: vec!["popular".into()],
                rough_score: fs_likes,
            });
        }
        CandidateBatch {
            source: "popular".into(),
            items,
        }
    }
}

pub struct FollowingCandidateSource {
    pub pool: PgPool,
    pub viewer_id: Uuid,
}

#[async_trait]
impl CandidateSource for FollowingCandidateSource {
    fn name(&self) -> SourceId {
        SourceId("following".into())
    }

    async fn fetch(&self, ctx: &RetrievalContext) -> CandidateBatch {
        let limit = ctx.limit_per_source as i64;
        let rows: Vec<(Uuid, OffsetDateTime)> = sqlx::query_as(
            r#"
            SELECT s.id, s.created_at
            FROM stories s
            INNER JOIN universe_follows uf ON uf.universe_id = s.universe_id
            WHERE uf.user_id = $1
            ORDER BY s.created_at DESC
            LIMIT $2
            "#,
        )
        .bind(self.viewer_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .unwrap_or_default();

        let now = OffsetDateTime::now_utc();
        CandidateBatch {
            source: "following".into(),
            items: rows
                .into_iter()
                .map(|(id, created)| {
                    let age = (now - created).whole_seconds().max(0) as f64;
                    Candidate {
                        id,
                        item_type: ItemType::Story,
                        reasons: vec!["following".into(), "recent".into()],
                        rough_score: 1_000_000.0 - age + 100_000.0,
                    }
                })
                .collect(),
        }
    }
}
