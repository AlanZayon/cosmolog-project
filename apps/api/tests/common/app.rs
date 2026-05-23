use std::sync::Arc;

use axum::body::Body;
use axum::http::{header, Method, Request, Response, StatusCode};
use axum::Router;
use cosmolog_api::app;
use cosmolog_api::auth::{AuthUser, MockTokenValidator, TokenValidator};
use cosmolog_api::config::Config;
use cosmolog_api::state::AppState;
use http_body_util::BodyExt;
use serde_json::Value;
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

use super::fixtures::TestUser;

pub struct TestApp {
    pub pool: PgPool,
    pub config: Config,
    jwt: Arc<MockTokenValidator>,
}

impl TestApp {
    pub async fn new() -> Option<Self> {
        let pool = super::db::test_db().await?;
        let config = super::test_config();
        let jwt = MockTokenValidator::rejecting();
        Some(Self { pool, config, jwt })
    }

    pub fn router(&self) -> Router {
        let state = AppState::new(
            self.pool.clone(),
            self.jwt.clone() as Arc<dyn TokenValidator>,
            &self.config,
        );
        app::router(state, &self.config)
    }

    pub fn register_user(&self, user: &TestUser) -> String {
        let token = format!("test-token-{}", user.user_id);
        self.jwt.register_token(
            &token,
            AuthUser {
                user_id: user.user_id,
                role: "authenticated".into(),
                email: Some(format!("{}@example.com", user.profile.username)),
                raw_token: None,
            },
        );
        token
    }

    pub fn register_user_id(&self, user_id: Uuid, username: &str) -> String {
        let token = format!("test-token-{user_id}");
        self.jwt.register_token(
            &token,
            AuthUser {
                user_id,
                role: "authenticated".into(),
                email: Some(format!("{username}@example.com")),
                raw_token: None,
            },
        );
        token
    }

    pub async fn request(&self, req: Request<Body>) -> Response<Body> {
        self.router().oneshot(req).await.expect("router response")
    }

    pub async fn get(&self, path: &str, token: Option<&str>) -> Response<Body> {
        self.send(Method::GET, path, token, None).await
    }

    pub async fn post_json(&self, path: &str, token: Option<&str>, body: Value) -> Response<Body> {
        self.send(
            Method::POST,
            path,
            token,
            Some(body.to_string().into_bytes()),
        )
        .await
    }

    pub async fn patch_json(&self, path: &str, token: Option<&str>, body: Value) -> Response<Body> {
        self.send(
            Method::PATCH,
            path,
            token,
            Some(body.to_string().into_bytes()),
        )
        .await
    }

    pub async fn delete(&self, path: &str, token: Option<&str>) -> Response<Body> {
        self.send(Method::DELETE, path, token, None).await
    }

    async fn send(
        &self,
        method: Method,
        path: &str,
        token: Option<&str>,
        body: Option<Vec<u8>>,
    ) -> Response<Body> {
        let mut builder = Request::builder().method(method).uri(path);
        if let Some(token) = token {
            builder = builder.header(header::AUTHORIZATION, format!("Bearer {token}"));
        }
        if body.is_some() {
            builder = builder.header(header::CONTENT_TYPE, "application/json");
        }
        let req = builder
            .body(Body::from(body.unwrap_or_default()))
            .expect("build request");
        self.request(req).await
    }
}

pub async fn json(response: Response<Body>) -> Value {
    let status = response.status();
    let bytes = response
        .into_body()
        .collect()
        .await
        .expect("body")
        .to_bytes();
    serde_json::from_slice(&bytes).unwrap_or_else(|e| {
        panic!(
            "invalid json (status {status}): {e}\nbody: {}",
            String::from_utf8_lossy(&bytes)
        )
    })
}

pub fn assert_status(response: &Response<Body>, expected: StatusCode) {
    let status = response.status();
    assert_eq!(status, expected, "unexpected status {status}");
}

pub async fn setup_app() -> Option<TestApp> {
    TestApp::new().await
}
