mod common;

use axum::Json;
use cosmolog_api::routes::health::{health, HealthResponse};

#[tokio::test]
async fn health_returns_ok_status() {
    let Json(HealthResponse { status, service }) = health().await;
    assert_eq!(status, "ok");
    assert_eq!(service, "cosmolog-api");
}
