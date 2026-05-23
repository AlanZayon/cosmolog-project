mod common;

use axum::body::Body;
use axum::http::{Method, StatusCode};
use cosmolog_api::middleware::request_context::REQUEST_ID_HEADER;

use common::app::{assert_status, setup_app};

#[tokio::test]
async fn health_returns_ok_via_router() {
    let Some(app) = setup_app().await else { return };

    let response = app.get("/health", None).await;
    assert_status(&response, StatusCode::OK);
}

#[tokio::test]
async fn db_ping_returns_ok_with_test_database() {
    let Some(app) = setup_app().await else { return };

    let response = app.get("/db/ping", None).await;
    assert_status(&response, StatusCode::OK);
}

#[tokio::test]
async fn response_includes_request_id_header() {
    let Some(app) = setup_app().await else { return };

    let response = app.get("/health", None).await;
    assert!(response.headers().get(REQUEST_ID_HEADER).is_some());
}

#[tokio::test]
async fn propagates_client_request_id() {
    let Some(app) = setup_app().await else { return };

    let response = app
        .request(
            axum::http::Request::builder()
                .method(Method::GET)
                .uri("/health")
                .header(REQUEST_ID_HEADER, "client-req-123")
                .body(Body::empty())
                .unwrap(),
        )
        .await;

    assert_eq!(
        response.headers().get(REQUEST_ID_HEADER).unwrap(),
        "client-req-123"
    );
}

#[tokio::test]
async fn cors_allows_configured_origin_preflight() {
    let Some(app) = setup_app().await else { return };

    let response = app
        .request(
            axum::http::Request::builder()
                .method(Method::OPTIONS)
                .uri("/health")
                .header("Origin", "http://localhost:3000")
                .header("Access-Control-Request-Method", "GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response
            .headers()
            .get("access-control-allow-origin")
            .and_then(|v| v.to_str().ok()),
        Some("http://localhost:3000")
    );
}
