use axum::extract::{Query, State};
use axum::Json;
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::Row;
use uuid::Uuid;

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

/// Home feed via the `get_feed` SQL function (personalized when authenticated).
pub async fn list(
    State(state): State<AppState>,
    OptionalAuth { user, .. }: OptionalAuth,
    Query(query): Query<FeedQuery>,
) -> Result<Json<Value>, AppError> {
    let limit = query.limit.clamp(1, 100);
    let viewer_id = user.map(|u| u.user_id);

    let rows = sqlx::query(
        "SELECT id, type, payload, ranking_score FROM public.get_feed($1, $2)",
    )
    .bind(limit)
    .bind(viewer_id)
    .fetch_all(&state.pool)
    .await
    .map_err(AppError::from_db)?;

    let items: Vec<Value> = rows
        .into_iter()
        .map(|row| {
            json!({
                "id": row.get::<Uuid, _>("id"),
                "type": row.get::<String, _>("type"),
                "payload": row.get::<Value, _>("payload"),
                "ranking_score": row.get::<f64, _>("ranking_score"),
            })
        })
        .collect();

    Ok(Json(Value::Array(items)))
}
