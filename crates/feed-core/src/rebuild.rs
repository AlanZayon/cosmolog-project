//! Rebuild user timeline: candidates → rank → Redis materializer + hydrate payloads.

use feed_contracts::candidates::{CandidateMixer, CandidateSource, RetrievalContext};
use feed_contracts::ids::ViewerId;
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

use crate::candidates::{FollowingCandidateSource, PopularityCandidateSource, RecentCandidateSource};
use crate::hydrate::hydrate_story_payloads;
use crate::ranking::{rank_candidates, ExperimentAssignment, RankingPipeline};
use crate::redis_fs::RedisFeatureStore;
use crate::redis_timeline::RedisTimelineStore;

pub struct RebuildDeps {
    pub pool: PgPool,
    pub features: RedisFeatureStore,
    pub timelines: RedisTimelineStore,
    pub weights: serde_json::Value,
}

pub async fn rebuild_user_timeline(deps: &RebuildDeps, user_id: Uuid) -> anyhow::Result<usize> {
    let ctx = RetrievalContext {
        viewer_id: Some(ViewerId(user_id)),
        limit_per_source: 100,
        experiment_arms: vec![],
    };

    let recent = RecentCandidateSource {
        pool: deps.pool.clone(),
    };
    let popular = PopularityCandidateSource {
        store: deps.features.clone(),
        pool: deps.pool.clone(),
    };
    let following = FollowingCandidateSource {
        pool: deps.pool.clone(),
        viewer_id: user_id,
    };

    let batches = vec![
        recent.fetch(&ctx).await,
        popular.fetch(&ctx).await,
        following.fetch(&ctx).await,
    ];
    let set = CandidateMixer { max_total: 500 }.merge(batches);

    let mut features = Vec::with_capacity(set.items.len());
    for c in &set.items {
        features.push(deps.features.get("story", c.id).await.unwrap_or_default());
    }

    let pipeline = RankingPipeline::from_weights(deps.weights.clone());
    let ranked = rank_candidates(
        &pipeline,
        set,
        &features,
        &ExperimentAssignment {
            experiment_id: "feed_v1".into(),
            arm: "control".into(),
            weights: json!({}),
        },
    );

    let ids: Vec<Uuid> = ranked.iter().map(|s| s.candidate.id).collect();
    let payloads = hydrate_story_payloads(&deps.pool, &ids).await?;
    for (id, payload) in payloads {
        deps.timelines.put_payload("story", id, payload).await?;
    }

    let count = ranked.len();
    deps.timelines.write_timeline(user_id, &ranked).await?;
    Ok(count)
}

/// Followers of a universe (capped).
pub async fn list_universe_followers(
    pool: &PgPool,
    universe_id: Uuid,
    cap: i64,
) -> anyhow::Result<Vec<Uuid>> {
    let rows: Vec<(Uuid,)> = sqlx::query_as(
        r#"
        SELECT user_id FROM universe_follows
        WHERE universe_id = $1
        LIMIT $2
        "#,
    )
    .bind(universe_id)
    .bind(cap)
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(|(id,)| id).collect())
}
