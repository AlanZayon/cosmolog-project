use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::Deserialize;

use crate::config::GoogleOAuthConfig;

#[derive(Debug, Deserialize)]
pub struct GoogleIdClaims {
    pub sub: String,
    pub email: Option<String>,
    #[serde(default)]
    pub email_verified: bool,
    pub name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GoogleTokenResponse {
    id_token: String,
}

/// Exchanges an authorization code (PKCE) with the configured token endpoint
/// (Google or local Fake IdP) and returns identity claims from the ID token.
pub async fn exchange_code(
    http: &reqwest::Client,
    config: &GoogleOAuthConfig,
    code: &str,
    code_verifier: &str,
    redirect_uri: &str,
) -> Result<GoogleIdClaims, String> {
    let params = [
        ("client_id", config.client_id.as_str()),
        ("client_secret", config.client_secret.as_str()),
        ("code", code),
        ("code_verifier", code_verifier),
        ("grant_type", "authorization_code"),
        ("redirect_uri", redirect_uri),
    ];

    let res = http
        .post(&config.token_url)
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("oauth token request failed: {e}"))?;

    let status = res.status();
    let body = res
        .text()
        .await
        .map_err(|e| format!("oauth token response read failed: {e}"))?;
    if !status.is_success() {
        return Err(format!("oauth token exchange failed (status {status})"));
    }

    let token: GoogleTokenResponse =
        serde_json::from_str(&body).map_err(|e| format!("invalid oauth token response: {e}"))?;

    parse_id_token(&token.id_token, &config.client_id, &config.issuers)
}

/// Parses the ID token received from the token endpoint over TLS (or local HTTP in
/// Docker). The signature is not re-verified; audience, issuer and expiry are validated.
pub fn parse_id_token(
    id_token: &str,
    client_id: &str,
    issuers: &[String],
) -> Result<GoogleIdClaims, String> {
    let mut validation = Validation::new(Algorithm::RS256);
    // Google uses RS256; unit tests may mint HS256. Signature is not verified either way.
    validation.algorithms = vec![Algorithm::RS256, Algorithm::HS256];
    validation.insecure_disable_signature_validation();
    validation.set_audience(&[client_id]);
    let issuer_refs: Vec<&str> = issuers.iter().map(String::as_str).collect();
    validation.set_issuer(&issuer_refs);
    validation.validate_exp = true;

    decode::<GoogleIdClaims>(id_token, &DecodingKey::from_secret(&[]), &validation)
        .map(|data| data.claims)
        .map_err(|e| format!("invalid oauth id_token: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use jsonwebtoken::{encode, EncodingKey, Header};
    use serde::Serialize;

    #[derive(Serialize)]
    struct TestClaims {
        sub: String,
        aud: String,
        iss: String,
        exp: i64,
        email: String,
        email_verified: bool,
    }

    fn make_token(aud: &str, iss: &str, exp_offset: i64) -> String {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        let claims = TestClaims {
            sub: "google-sub-123".into(),
            aud: aud.into(),
            iss: iss.into(),
            exp: now + exp_offset,
            email: "user@gmail.com".into(),
            email_verified: true,
        };
        encode(
            &Header::new(Algorithm::HS256),
            &claims,
            &EncodingKey::from_secret(b"irrelevant"),
        )
        .unwrap()
    }

    fn google_issuers() -> Vec<String> {
        vec![
            "https://accounts.google.com".into(),
            "accounts.google.com".into(),
        ]
    }

    #[test]
    fn parses_valid_id_token() {
        let token = make_token("my-client", "https://accounts.google.com", 3600);
        let claims = parse_id_token(&token, "my-client", &google_issuers()).expect("claims");
        assert_eq!(claims.sub, "google-sub-123");
        assert_eq!(claims.email.as_deref(), Some("user@gmail.com"));
        assert!(claims.email_verified);
    }

    #[test]
    fn parses_local_issuer() {
        let token = make_token("cosmolog-local", "http://localhost:9090", 3600);
        let issuers = vec!["http://localhost:9090".into()];
        let claims = parse_id_token(&token, "cosmolog-local", &issuers).expect("claims");
        assert_eq!(claims.sub, "google-sub-123");
    }

    #[test]
    fn rejects_wrong_audience() {
        let token = make_token("other-client", "https://accounts.google.com", 3600);
        assert!(parse_id_token(&token, "my-client", &google_issuers()).is_err());
    }

    #[test]
    fn rejects_wrong_issuer() {
        let token = make_token("my-client", "https://evil.example", 3600);
        assert!(parse_id_token(&token, "my-client", &google_issuers()).is_err());
    }

    #[test]
    fn rejects_expired_token() {
        let token = make_token("my-client", "https://accounts.google.com", -3600);
        assert!(parse_id_token(&token, "my-client", &google_issuers()).is_err());
    }
}
