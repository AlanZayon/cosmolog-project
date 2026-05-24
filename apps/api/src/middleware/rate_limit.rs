use std::num::NonZeroU32;
use std::sync::{Arc, OnceLock};

use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use governor::{
    clock::DefaultClock,
    state::keyed::DashMapStateStore,
    Quota, RateLimiter,
};
use serde_json::json;

type KeyedLimiter = RateLimiter<String, DashMapStateStore<String>, DefaultClock>;

static AUTH_LIMITER: OnceLock<Arc<KeyedLimiter>> = OnceLock::new();

fn auth_limiter() -> Arc<KeyedLimiter> {
    AUTH_LIMITER
        .get_or_init(|| {
            let quota = Quota::per_minute(NonZeroU32::new(30).expect("non-zero quota"));
            Arc::new(RateLimiter::dashmap(quota))
        })
        .clone()
}

fn client_key(request: &Request) -> String {
    request
        .headers()
        .get("x-forwarded-for")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(',').next())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| "unknown".to_string())
}

/// Per-IP rate limit for auth endpoints (sign-in, sign-up, refresh).
pub async fn auth_rate_limit(request: Request, next: Next) -> Response {
    let key = client_key(&request);
    let limiter = auth_limiter();

    if limiter.check_key(&key).is_err() {
        return (
            StatusCode::TOO_MANY_REQUESTS,
            Json(json!({ "error": "rate limit exceeded" })),
        )
            .into_response();
    }

    next.run(request).await
}
