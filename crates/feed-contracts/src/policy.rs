use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::ids::{ItemId, ViewerId};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FilterDecision {
    Allow,
    Drop,
    Demote,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyDecision {
    pub item_id: ItemId,
    pub decision: FilterDecision,
    pub demote_factor: Option<f64>,
}

#[async_trait]
pub trait PolicyClient: Send + Sync {
    async fn evaluate(&self, viewer: Option<ViewerId>, item_ids: &[ItemId]) -> Vec<PolicyDecision>;
}

/// Phase A stub — everything allowed.
#[derive(Debug, Default, Clone)]
pub struct AllowAllPolicy;

#[async_trait]
impl PolicyClient for AllowAllPolicy {
    async fn evaluate(&self, _viewer: Option<ViewerId>, item_ids: &[ItemId]) -> Vec<PolicyDecision> {
        item_ids
            .iter()
            .map(|id| PolicyDecision {
                item_id: *id,
                decision: FilterDecision::Allow,
                demote_factor: None,
            })
            .collect()
    }
}

/// Convenience for Uuid lists.
pub fn item_ids(ids: impl IntoIterator<Item = Uuid>) -> Vec<ItemId> {
    ids.into_iter().map(ItemId).collect()
}
