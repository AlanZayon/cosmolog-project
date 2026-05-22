use serde::{Deserialize, Serialize};

use super::SupabaseClient;

#[derive(Debug, Deserialize)]
pub struct SignInRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct SignUpRequest {
    pub email: String,
    pub password: String,
    pub username: String,
}

#[derive(Debug, Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthUser {
    pub id: String,
    pub email: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthSession {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64,
    pub token_type: String,
    pub user: AuthUser,
}

#[derive(Debug, Deserialize)]
struct GoTrueSession {
    access_token: String,
    refresh_token: String,
    expires_in: i64,
    token_type: String,
    user: GoTrueUser,
}

#[derive(Debug, Deserialize)]
struct GoTrueUser {
    id: String,
    email: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GoTrueError {
    error: Option<String>,
    error_description: Option<String>,
    msg: Option<String>,
    message: Option<String>,
}

impl GoTrueError {
    fn message(&self) -> String {
        self.error_description
            .clone()
            .or_else(|| self.message.clone())
            .or_else(|| self.msg.clone())
            .or_else(|| self.error.clone())
            .unwrap_or_else(|| "authentication failed".to_string())
    }
}

fn map_session(raw: GoTrueSession) -> AuthSession {
    AuthSession {
        access_token: raw.access_token,
        refresh_token: raw.refresh_token,
        expires_in: raw.expires_in,
        token_type: raw.token_type,
        user: AuthUser {
            id: raw.user.id,
            email: raw.user.email,
        },
    }
}

pub async fn sign_in(client: &SupabaseClient, req: SignInRequest) -> Result<AuthSession, String> {
    let url = format!("{}/auth/v1/token?grant_type=password", client.url);
    let res = client
        .http
        .post(&url)
        .header("apikey", &client.anon_key)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "email": req.email,
            "password": req.password,
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    parse_auth_response(res).await
}

pub async fn sign_up(client: &SupabaseClient, req: SignUpRequest) -> Result<AuthSession, String> {
    let url = format!("{}/auth/v1/signup", client.url);
    let res = client
        .http
        .post(&url)
        .header("apikey", &client.anon_key)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "email": req.email,
            "password": req.password,
            "data": { "username": req.username },
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    parse_auth_response(res).await
}

pub async fn refresh(client: &SupabaseClient, req: RefreshRequest) -> Result<AuthSession, String> {
    let url = format!("{}/auth/v1/token?grant_type=refresh_token", client.url);
    let res = client
        .http
        .post(&url)
        .header("apikey", &client.anon_key)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "refresh_token": req.refresh_token,
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    parse_auth_response(res).await
}

async fn parse_auth_response(res: reqwest::Response) -> Result<AuthSession, String> {
    let status = res.status();
    let body = res.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        if let Ok(err) = serde_json::from_str::<GoTrueError>(&body) {
            return Err(err.message());
        }
        return Err(body);
    }
    let raw: GoTrueSession = serde_json::from_str(&body).map_err(|e| format!("{e}: {body}"))?;
    Ok(map_session(raw))
}
