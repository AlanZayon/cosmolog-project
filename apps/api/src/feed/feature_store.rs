//! Online feature store (Phase B). In-memory for tests; Redis-backed when URL set.

use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use feed_contracts::features::{FeatureValue, FeatureVector};
use uuid::Uuid;

#[derive(Clone, Default)]
pub struct MemoryFeatureStore {
    inner: Arc<RwLock<HashMap<String, FeatureVector>>>,
}

impl MemoryFeatureStore {
    pub fn new() -> Self {
        Self::default()
    }

    fn entity_key(entity: &str, id: Uuid) -> String {
        format!("{entity}:{id}")
    }

    pub fn set_feature(&self, entity: &str, id: Uuid, name: &str, value: FeatureValue) {
        let key = Self::entity_key(entity, id);
        let mut guard = self.inner.write().expect("fs write");
        let vec = guard.entry(key).or_default();
        vec.values.insert(name.to_string(), value);
    }

    pub fn get(&self, entity: &str, id: Uuid) -> FeatureVector {
        let key = Self::entity_key(entity, id);
        self.inner
            .read()
            .expect("fs read")
            .get(&key)
            .cloned()
            .unwrap_or_default()
    }

    pub fn mget(&self, entity: &str, ids: &[Uuid]) -> Vec<FeatureVector> {
        ids.iter().map(|id| self.get(entity, *id)).collect()
    }

    pub fn incr_f64(&self, entity: &str, id: Uuid, name: &str, by: f64) {
        let key = Self::entity_key(entity, id);
        let mut guard = self.inner.write().expect("fs write");
        let vec = guard.entry(key).or_default();
        let next = match vec.values.get(name) {
            Some(FeatureValue::Float(v)) => *v + by,
            Some(FeatureValue::Int(v)) => *v as f64 + by,
            _ => by,
        };
        vec.values
            .insert(name.to_string(), FeatureValue::Float(next));
    }
}
