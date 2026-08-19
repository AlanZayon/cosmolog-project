use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

use crate::ids::ViewerId;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ItemType {
    Story,
    Arc,
    Universe,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct SourceId(pub String);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Candidate {
    pub id: Uuid,
    pub item_type: ItemType,
    pub reasons: Vec<String>,
    pub rough_score: f64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CandidateBatch {
    pub source: String,
    pub items: Vec<Candidate>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CandidateSet {
    pub items: Vec<Candidate>,
}

#[derive(Debug, Clone)]
pub struct RetrievalContext {
    pub viewer_id: Option<ViewerId>,
    pub limit_per_source: usize,
    pub experiment_arms: Vec<String>,
}

impl Default for RetrievalContext {
    fn default() -> Self {
        Self {
            viewer_id: None,
            limit_per_source: 100,
            experiment_arms: Vec::new(),
        }
    }
}

#[async_trait]
pub trait CandidateSource: Send + Sync {
    fn name(&self) -> SourceId;
    async fn fetch(&self, ctx: &RetrievalContext) -> CandidateBatch;
}

/// Merges batches: dedup by (item_type, id), first source wins reasons union, caps total K.
pub struct CandidateMixer {
    pub max_total: usize,
}

impl Default for CandidateMixer {
    fn default() -> Self {
        Self { max_total: 500 }
    }
}

impl CandidateMixer {
    pub fn merge(&self, batches: Vec<CandidateBatch>) -> CandidateSet {
        let mut seen: HashSet<(ItemType, Uuid)> = HashSet::new();
        let mut by_id: HashMap<(ItemType, Uuid), Candidate> = HashMap::new();
        let mut order: Vec<(ItemType, Uuid)> = Vec::new();

        for batch in batches {
            for mut item in batch.items {
                let key = (item.item_type, item.id);
                if let Some(existing) = by_id.get_mut(&key) {
                    for r in item.reasons.drain(..) {
                        if !existing.reasons.iter().any(|e| e == &r) {
                            existing.reasons.push(r);
                        }
                    }
                    existing.rough_score = existing.rough_score.max(item.rough_score);
                } else if seen.insert(key) {
                    order.push(key);
                    by_id.insert(key, item);
                }
            }
        }

        let mut items: Vec<Candidate> =
            order.into_iter().filter_map(|k| by_id.remove(&k)).collect();
        if items.len() > self.max_total {
            items.truncate(self.max_total);
        }
        CandidateSet { items }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mixer_dedups_and_caps() {
        let mixer = CandidateMixer { max_total: 2 };
        let id = Uuid::new_v4();
        let batches = vec![
            CandidateBatch {
                source: "recent".into(),
                items: vec![
                    Candidate {
                        id,
                        item_type: ItemType::Story,
                        reasons: vec!["recent".into()],
                        rough_score: 1.0,
                    },
                    Candidate {
                        id: Uuid::new_v4(),
                        item_type: ItemType::Story,
                        reasons: vec!["recent".into()],
                        rough_score: 0.5,
                    },
                ],
            },
            CandidateBatch {
                source: "trending".into(),
                items: vec![Candidate {
                    id,
                    item_type: ItemType::Story,
                    reasons: vec!["trending".into()],
                    rough_score: 2.0,
                }],
            },
        ];
        let set = mixer.merge(batches);
        assert_eq!(set.items.len(), 2);
        assert!(set.items[0].reasons.contains(&"recent".to_string()));
        assert!(set.items[0].reasons.contains(&"trending".to_string()));
        assert_eq!(set.items[0].rough_score, 2.0);
    }
}
