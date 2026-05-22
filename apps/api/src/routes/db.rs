use axum::extract::State;
use axum::Json;
use serde::Serialize;

use crate::error::AppError;
use crate::state::AppState;

#[derive(Serialize)]
pub struct DbPingResponse {
    pub database: &'static str,
}

pub async fn ping(State(state): State<AppState>) -> Result<Json<DbPingResponse>, AppError> {
    sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&state.pool)
        .await?;

    Ok(Json(DbPingResponse { database: "ok" }))
}
