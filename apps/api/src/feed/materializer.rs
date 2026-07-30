//! Timeline materializer (Phase C) — writes only to in-process feed-serving store.
//! Logical redis-feed-serving role; Memory implementation for Phase C.

use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use uuid::Uuid;

use super::ranking::ScoredItem;

#[derive(Clone, Default)]
pub struct TimelineMaterializer {
    timelines: Arc<RwLock<HashMap<Uuid, Vec<(Uuid, f64)>>>>,
    payloads: Arc<RwLock<HashMap<Uuid, serde_json::Value>>>,
}

impl TimelineMaterializer {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn write_timeline(&self, user_id: Uuid, scored: &[ScoredItem]) {
        let mut items: Vec<(Uuid, f64)> = scored
            .iter()
            .map(|s| (s.candidate.id, s.score))
            .collect();
        items.truncate(500);
        self.timelines
            .write()
            .expect("timeline write")
            .insert(user_id, items);
    }

    pub fn read_timeline(&self, user_id: Uuid, limit: usize) -> Vec<(Uuid, f64)> {
        self.timelines
            .read()
            .expect("timeline read")
            .get(&user_id)
            .map(|v| v.iter().take(limit).cloned().collect())
            .unwrap_or_default()
    }

    pub fn put_payload(&self, story_id: Uuid, payload: serde_json::Value) {
        self.payloads
            .write()
            .expect("payload write")
            .insert(story_id, payload);
    }

    pub fn get_payload(&self, story_id: Uuid) -> Option<serde_json::Value> {
        self.payloads
            .read()
            .expect("payload read")
            .get(&story_id)
            .cloned()
    }

    pub fn invalidate_user(&self, user_id: Uuid) {
        self.timelines
            .write()
            .expect("timeline write")
            .remove(&user_id);
    }
}
