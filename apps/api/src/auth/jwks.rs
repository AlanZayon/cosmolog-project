use anyhow::{anyhow, Context, Result};
use jsonwebtoken::{Algorithm, DecodingKey};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct JwksResponse {
    pub keys: Vec<Jwk>,
}

#[derive(Debug, Deserialize)]
pub struct Jwk {
    pub kid: String,
    pub kty: String,
    #[serde(default)]
    pub alg: Option<String>,
    #[serde(default)]
    pub n: Option<String>,
    #[serde(default)]
    pub e: Option<String>,
    #[serde(default)]
    pub x: Option<String>,
    #[serde(default)]
    pub y: Option<String>,
    #[serde(default)]
    pub crv: Option<String>,
}

#[derive(Clone)]
pub struct CachedKey {
    pub kid: String,
    pub algorithm: Algorithm,
    pub decoding_key: DecodingKey,
}

impl Jwk {
    pub fn into_cached_key(self) -> Result<CachedKey> {
        let algorithm = match self.alg.as_deref() {
            Some("RS256") => Algorithm::RS256,
            Some("ES256") => Algorithm::ES256,
            Some(other) => return Err(anyhow!("unsupported JWK alg: {other}")),
            None => match self.kty.as_str() {
                "RSA" => Algorithm::RS256,
                "EC" => Algorithm::ES256,
                other => return Err(anyhow!("cannot infer algorithm for kty={other}")),
            },
        };

        let decoding_key = match self.kty.as_str() {
            "RSA" => {
                let n = self.n.context("RSA key missing n")?;
                let e = self.e.context("RSA key missing e")?;
                DecodingKey::from_rsa_components(&n, &e)
                    .context("invalid RSA key components")?
            }
            "EC" => {
                let x = self.x.context("EC key missing x")?;
                let y = self.y.context("EC key missing y")?;
                DecodingKey::from_ec_components(&x, &y).context("invalid EC key components")?
            }
            other => return Err(anyhow!("unsupported JWK kty: {other}")),
        };

        Ok(CachedKey {
            kid: self.kid,
            algorithm,
            decoding_key,
        })
    }
}

pub async fn fetch_jwks(client: &reqwest::Client, jwks_url: &str) -> Result<Vec<CachedKey>> {
    let response = client
        .get(jwks_url)
        .send()
        .await
        .context("failed to fetch JWKS")?
        .error_for_status()
        .context("JWKS endpoint returned error status")?;

    let jwks: JwksResponse = response.json().await.context("invalid JWKS JSON")?;

    jwks.keys
        .into_iter()
        .map(Jwk::into_cached_key)
        .collect()
}
