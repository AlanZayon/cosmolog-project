//! Candidate sources (Phase B) — retrieval only; not wired to GET /feed yet.

use async_trait::async_trait;
use feed_contracts::candidates::{
    Candidate, CandidateBatch, CandidateSource, ItemType, RetrievalContext, SourceId,
};
use sqlx::PgPool;
use time::OffsetDateTime;
use uuid::Uuid;

use super::feature_store::MemoryFeatureStore;

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
    pub store: MemoryFeatureStore,
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

        CandidateBatch {
            source: "popular".into(),
            items: rows
                .into_iter()
                .map(|(id, likes)| {
                    // Prefer FS when present
                    let fs_likes = self
                        .store
                        .get("story", id)
                        .get_f64("story.likes_count")
                        .unwrap_or(likes as f64);
                    Candidate {
                        id,
                        item_type: ItemType::Story,
                        reasons: vec!["popular".into()],
                        rough_score: fs_likes,
                    }
                })
                .collect(),
        }
    }
}

#[cfg(test)]
mod tests {
    use feed_contracts::candidates::CandidateMixer;

    use super::*;

    #[test]
    fn two_sources_merge_via_mixer() {
        let mixer = CandidateMixer { max_total: 10 };
        let id = Uuid::new_v4();
        let set = mixer.merge(vec![
            CandidateBatch {
                source: "recent".into(),
                items: vec![Candidate {
                    id,
                    item_type: ItemType::Story,
                    reasons: vec!["recent".into()],
                    rough_score: 1.0,
                }],
            },
            CandidateBatch {
                source: "popular".into(),
                items: vec![Candidate {
                    id,
                    item_type: ItemType::Story,
                    reasons: vec!["popular".into()],
                    rough_score: 5.0,
                }],
            },
        ]);
        assert_eq!(set.items.len(), 1);
        assert_eq!(set.items[0].reasons.len(), 2);
    }
}
