use std::num::NonZeroU32;
use std::sync::{Arc, OnceLock};

use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use governor::{clock::DefaultClock, state::keyed::DashMapStateStore, Quota, RateLimiter};
use serde_json::json;

type KeyedLimiter = RateLimiter<String, DashMapStateStore<String>, DefaultClock>;

static AUTH_LIMITER: OnceLock<Arc<KeyedLimiter>> = OnceLock::new();

fn is_production() -> bool {
    std::env::var("APP_ENV")
        .map(|value| value.eq_ignore_ascii_case("production"))
        .unwrap_or(false)
}

fn auth_limiter() -> Arc<KeyedLimiter> {
    AUTH_LIMITER
        .get_or_init(|| {
            // Dev: generous limit so local BFF traffic does not share one tiny bucket.
            // Prod: protect sign-in/sign-up/oauth from brute force.
            let per_minute = if is_production() { 30 } else { 500 };
            let quota = Quota::per_minute(NonZeroU32::new(per_minute).expect("non-zero quota"));
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
        .or_else(|| {
            request
                .headers()
                .get("x-real-ip")
                .and_then(|value| value.to_str().ok())
                .map(str::trim)
                .filter(|value| !value.is_empty())
        })
        .map(str::to_string)
        .unwrap_or_else(|| "unknown".to_string())
}

fn rate_limited_response() -> Response {
    (
        StatusCode::TOO_MANY_REQUESTS,
        Json(json!({ "error": "rate_limited" })),
    )
        .into_response()
}

/// Per-IP rate limit for sensitive auth endpoints (sign-in, sign-up, oauth exchange).
pub async fn auth_rate_limit(request: Request, next: Next) -> Response {
    let key = client_key(&request);
    let limiter = auth_limiter();

    if limiter.check_key(&key).is_err() {
        return rate_limited_response();
    }

    next.run(request).await
}
