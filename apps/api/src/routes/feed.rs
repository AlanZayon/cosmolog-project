use axum::extract::{Query, State};
use axum::Json;
use serde::Deserialize;
use serde_json::Value;

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

/// Home feed via Supabase `get_feed` RPC (personalized when JWT is sent).
pub async fn list(
    State(state): State<AppState>,
    OptionalAuth { token, .. }: OptionalAuth,
    Query(query): Query<FeedQuery>,
) -> Result<Json<Value>, AppError> {
    let limit = query.limit.clamp(1, 100);
    let data = state
        .supabase
        .get_feed(token.as_deref(), limit)
        .await
        .map_err(AppError::Upstream)?;
    Ok(Json(data))
}
