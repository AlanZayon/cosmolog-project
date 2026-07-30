use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Port for future ANN / embedding platform (Phase D). Stub returns empty.
#[async_trait]
pub trait VectorSearch: Send + Sync {
    async fn neighbors(&self, entity_id: Uuid, k: usize) -> Vec<NeighborHit>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NeighborHit {
    pub id: Uuid,
    pub score: f64,
}

#[derive(Debug, Default, Clone)]
pub struct NoopVectorSearch;

#[async_trait]
impl VectorSearch for NoopVectorSearch {
    async fn neighbors(&self, _entity_id: Uuid, _k: usize) -> Vec<NeighborHit> {
        Vec::new()
    }
}
