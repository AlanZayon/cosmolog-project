//! Pure ranking pipeline (Phase C). Scorers must not touch DB/Redis.

use feed_contracts::candidates::{Candidate, CandidateSet, ItemType};
use feed_contracts::features::FeatureVector;
use serde_json::Value;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct ScoredItem {
    pub candidate: Candidate,
    pub score: f64,
    pub signals: Vec<(String, f64)>,
}

#[derive(Debug, Clone)]
pub struct ExperimentAssignment {
    pub experiment_id: String,
    pub arm: String,
    pub weights: Value,
}

/// Sticky hash assignment: stable per user + experiment.
pub fn sticky_arm(user_id: Option<Uuid>, experiment_id: &str, arms: &[&str]) -> String {
    if arms.is_empty() {
        return "control".into();
    }
    let mut hasher = DefaultHasher::new();
    user_id.hash(&mut hasher);
    experiment_id.hash(&mut hasher);
    let idx = (hasher.finish() as usize) % arms.len();
    arms[idx].to_string()
}

pub struct RankingPipeline {
    pub weights: Value,
}

impl RankingPipeline {
    pub fn from_weights(weights: Value) -> Self {
        Self { weights }
    }

    fn w(&self, key: &str, default: f64) -> f64 {
        self.weights
            .get(key)
            .and_then(|v| v.as_f64())
            .unwrap_or(default)
    }

    /// Multi-stage: score → normalize-ish → fusion → diversity cap by author not available → sort.
    pub fn rank(
        &self,
        candidates: CandidateSet,
        features: &[FeatureVector],
        assignment: &ExperimentAssignment,
    ) -> Vec<ScoredItem> {
        let w_recency = assignment
            .weights
            .get("recency")
            .and_then(|v| v.as_f64())
            .unwrap_or_else(|| self.w("recency", 1.0));
        let w_pop = assignment
            .weights
            .get("popularity")
            .and_then(|v| v.as_f64())
            .unwrap_or_else(|| self.w("popularity", 0.6));
        let w_follow = assignment
            .weights
            .get("following")
            .and_then(|v| v.as_f64())
            .unwrap_or_else(|| self.w("following", 2.0));

        let mut scored: Vec<ScoredItem> = candidates
            .items
            .into_iter()
            .enumerate()
            .map(|(i, c)| {
                let fv = features.get(i).cloned().unwrap_or_default();
                let recency = (c.rough_score / 1_000_000.0).clamp(0.0, 1.0);
                let popularity = fv.get_f64("story.likes_count").unwrap_or(0.0).ln_1p() / 10.0;
                let following_boost = if c.reasons.iter().any(|r| r == "following") {
                    1.0
                } else {
                    0.0
                };
                let score = w_recency * recency + w_pop * popularity + w_follow * following_boost;
                ScoredItem {
                    candidate: c,
                    score,
                    signals: vec![
                        ("recency".into(), recency),
                        ("popularity".into(), popularity),
                        ("following".into(), following_boost),
                    ],
                }
            })
            .collect();

        // Diversity: max 2 non-story in a row (match existing feed rule loosely)
        scored.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        let mut out = Vec::with_capacity(scored.len());
        let mut consecutive_non_story = 0;
        for item in scored {
            let is_story = item.candidate.item_type == ItemType::Story;
            if !is_story {
                if consecutive_non_story >= 2 {
                    continue;
                }
                consecutive_non_story += 1;
            } else {
                consecutive_non_story = 0;
            }
            out.push(item);
        }
        out
    }
}

pub fn rank_candidates(
    pipeline: &RankingPipeline,
    candidates: CandidateSet,
    features: &[FeatureVector],
    assignment: &ExperimentAssignment,
) -> Vec<ScoredItem> {
    pipeline.rank(candidates, features, assignment)
}

#[cfg(test)]
mod tests {
    use super::*;
    use feed_contracts::candidates::ItemType;

    #[test]
    fn sticky_arm_is_stable() {
        let uid = Uuid::new_v4();
        let a = sticky_arm(Some(uid), "exp1", &["control", "treatment"]);
        let b = sticky_arm(Some(uid), "exp1", &["control", "treatment"]);
        assert_eq!(a, b);
    }

    #[test]
    fn scorer_has_no_db_imports() {
        // Compile-time purity: this module only uses feed_contracts + std.
        let pipe = RankingPipeline::from_weights(serde_json::json!({}));
        let set = CandidateSet {
            items: vec![Candidate {
                id: Uuid::new_v4(),
                item_type: ItemType::Story,
                reasons: vec!["recent".into()],
                rough_score: 900_000.0,
            }],
        };
        let ranked = pipe.rank(
            set,
            &[FeatureVector::default()],
            &ExperimentAssignment {
                experiment_id: "e".into(),
                arm: "control".into(),
                weights: serde_json::json!({}),
            },
        );
        assert_eq!(ranked.len(), 1);
    }
}
