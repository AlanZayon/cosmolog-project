use std::time::Instant;

use axum::{
    extract::Request,
    http::{HeaderName, HeaderValue},
    middleware::Next,
    response::Response,
};
use tracing::Instrument;
use uuid::Uuid;

use crate::infra::logging::SERVICE_NAME;

pub const REQUEST_ID_HEADER: &str = "x-request-id";

/// Correlation id propagated through a single HTTP request.
#[derive(Clone, Debug)]
#[allow(dead_code)]
pub struct RequestId(pub String);

pub async fn middleware(mut req: Request, next: Next) -> Response {
    let request_id = req
        .headers()
        .get(REQUEST_ID_HEADER)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    req.extensions_mut().insert(RequestId(request_id.clone()));

    let method = req.method().to_string();
    let path = req.uri().path().to_string();
    let app_env = std::env::var("APP_ENV").unwrap_or_else(|_| "development".to_string());

    let span = tracing::info_span!(
        "http_request",
        service = SERVICE_NAME,
        env = %app_env,
        request_id = %request_id,
        method = %method,
        path = %path,
        user_id = tracing::field::Empty,
        status = tracing::field::Empty,
        latency_ms = tracing::field::Empty,
    );

    let start = Instant::now();

    async move {
        let mut response = next.run(req).await;
        let latency_ms = start.elapsed().as_millis() as u64;
        let status = response.status().as_u16();

        let current = tracing::Span::current();
        current.record("status", status);
        current.record("latency_ms", latency_ms);

        if status >= 500 {
            tracing::error!(
                event = "http.request.completed",
                status = status,
                latency_ms = latency_ms,
                "request completed"
            );
        } else {
            tracing::info!(
                event = "http.request.completed",
                status = status,
                latency_ms = latency_ms,
                "request completed"
            );
        }

        if let Ok(value) = HeaderValue::from_str(&request_id) {
            response
                .headers_mut()
                .insert(HeaderName::from_static(REQUEST_ID_HEADER), value);
        }

        response
    }
    .instrument(span)
    .await
}
