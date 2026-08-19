use axum::extract::{Query, State};
use axum::Json;
use feed_contracts::gateway::FeedQuery as GatewayFeedQuery;
use feed_contracts::ids::ViewerId;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::auth::OptionalAuth;
use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct FeedQuery {
    #[serde(default = "default_limit")]
    pub limit: i32,
}

fn default_limit() -> i32 {
    24
}

/// Home feed via Feed Gateway (Phase A/B: SQL `get_feed` passthrough + policy stub).
pub async fn list(
    State(state): State<AppState>,
    OptionalAuth { user, .. }: OptionalAuth,
    Query(query): Query<FeedQuery>,
) -> Result<Json<Value>, AppError> {
    let limit = query.limit.clamp(1, 100);
    let viewer_id = user.map(|u| ViewerId(u.user_id));

    let items = state
        .feed_gateway
        .get_home_feed(GatewayFeedQuery {
            viewer_id,
            limit,
            cursor: None,
        })
        .await
        .map_err(AppError::Upstream)?;

    let item_count = items.len();
    tracing::info!(
        event = "feed.served",
        item_count,
        empty = item_count == 0,
        viewer = viewer_id.is_some(),
        "home feed served"
    );

    let body: Vec<Value> = items
        .into_iter()
        .map(|item| {
            json!({
                "id": item.id,
                "type": item.item_type,
                "payload": item.payload,
                "ranking_score": item.ranking_score,
            })
        })
        .collect();

    Ok(Json(Value::Array(body)))
}
