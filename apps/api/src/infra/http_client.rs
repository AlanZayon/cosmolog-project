use std::time::Duration;

use reqwest::Client;

/// Shared HTTP client for outbound calls (Supabase, JWKS).
pub fn build_http_client() -> Client {
    Client::builder()
        .timeout(Duration::from_secs(10))
        .connect_timeout(Duration::from_secs(5))
        .build()
        .expect("reqwest client")
}
