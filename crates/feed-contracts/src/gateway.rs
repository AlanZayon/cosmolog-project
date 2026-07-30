use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::ids::ViewerId;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FeedSourceMode {
    Sql,
    Shadow,
    Canary,
    Engine,
}

#[derive(Debug, Clone)]
pub struct FeedQuery {
    pub viewer_id: Option<ViewerId>,
    pub limit: i32,
    pub cursor: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeedResponseItem {
    pub id: Uuid,
    #[serde(rename = "type")]
    pub item_type: String,
    pub payload: Value,
    pub ranking_score: f64,
}

/// Serving boundary — API routes call this instead of Redis/SQL keys directly.
#[async_trait]
pub trait FeedGateway: Send + Sync {
    async fn get_home_feed(&self, query: FeedQuery) -> Result<Vec<FeedResponseItem>, String>;
    fn mode(&self) -> FeedSourceMode;
}
