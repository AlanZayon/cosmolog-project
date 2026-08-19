//! Minimal AWS SigV4 signing for the S3 and SES REST APIs.
//!
//! The official AWS SDK is intentionally not used (very large dependency
//! tree); only `PutObject` (S3) and `SendEmail` (SES v2) are needed.

use std::fmt::Write as _;

use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};
use time::format_description::FormatItem;
use time::macros::format_description;
use time::OffsetDateTime;

type HmacSha256 = Hmac<Sha256>;

const AMZ_DATE_FORMAT: &[FormatItem<'_>] =
    format_description!("[year][month][day]T[hour][minute][second]Z");
const DATE_FORMAT: &[FormatItem<'_>] = format_description!("[year][month][day]");

#[derive(Debug, Clone)]
pub struct AwsCredentials {
    pub region: String,
    pub access_key_id: String,
    pub secret_access_key: String,
    /// Optional session token (STS / task roles).
    pub session_token: Option<String>,
}

impl AwsCredentials {
    /// Reads the standard AWS env vars; `None` when not configured.
    pub fn from_env() -> Option<Self> {
        let region = std::env::var("AWS_REGION")
            .or_else(|_| std::env::var("AWS_DEFAULT_REGION"))
            .ok()?;
        let access_key_id = std::env::var("AWS_ACCESS_KEY_ID").ok()?;
        let secret_access_key = std::env::var("AWS_SECRET_ACCESS_KEY").ok()?;
        let session_token = std::env::var("AWS_SESSION_TOKEN")
            .ok()
            .filter(|t| !t.is_empty());
        Some(Self {
            region: region.trim().to_string(),
            access_key_id: access_key_id.trim().to_string(),
            secret_access_key: secret_access_key.trim().to_string(),
            session_token,
        })
    }
}

pub struct SignedRequest {
    /// Header name/value pairs to attach to the HTTP request.
    pub headers: Vec<(String, String)>,
}

fn hmac_sha256(key: &[u8], data: &[u8]) -> Vec<u8> {
    let mut mac = HmacSha256::new_from_slice(key).expect("hmac accepts any key length");
    mac.update(data);
    mac.finalize().into_bytes().to_vec()
}

fn sha256_hex(data: &[u8]) -> String {
    hex::encode(Sha256::digest(data))
}

/// RFC 3986 encoding for URI path segments (slashes preserved).
fn uri_encode_path(path: &str) -> String {
    let mut out = String::with_capacity(path.len());
    for byte in path.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' | b'/' => {
                out.push(byte as char)
            }
            _ => {
                let _ = write!(out, "%{byte:02X}");
            }
        }
    }
    out
}

/// Signs a request with AWS Signature Version 4 (single chunk, no query params).
///
/// `host` and `x-amz-*` headers are produced here and must be sent verbatim.
pub fn sign_request(
    credentials: &AwsCredentials,
    service: &str,
    method: &str,
    host: &str,
    path: &str,
    body: &[u8],
    now: OffsetDateTime,
) -> SignedRequest {
    let amz_date = now.format(AMZ_DATE_FORMAT).expect("format amz date");
    let date = now.format(DATE_FORMAT).expect("format date");
    let payload_hash = sha256_hex(body);

    let mut canonical_headers: Vec<(String, String)> = vec![
        ("host".into(), host.to_string()),
        ("x-amz-content-sha256".into(), payload_hash.clone()),
        ("x-amz-date".into(), amz_date.clone()),
    ];
    if let Some(token) = &credentials.session_token {
        canonical_headers.push(("x-amz-security-token".into(), token.clone()));
    }
    canonical_headers.sort();

    let signed_header_names = canonical_headers
        .iter()
        .map(|(name, _)| name.as_str())
        .collect::<Vec<_>>()
        .join(";");
    let canonical_header_lines = canonical_headers
        .iter()
        .map(|(name, value)| format!("{name}:{}\n", value.trim()))
        .collect::<String>();

    let canonical_request = format!(
        "{method}\n{}\n\n{canonical_header_lines}\n{signed_header_names}\n{payload_hash}",
        uri_encode_path(path),
    );

    let scope = format!("{date}/{}/{service}/aws4_request", credentials.region);
    let string_to_sign = format!(
        "AWS4-HMAC-SHA256\n{amz_date}\n{scope}\n{}",
        sha256_hex(canonical_request.as_bytes())
    );

    let k_date = hmac_sha256(
        format!("AWS4{}", credentials.secret_access_key).as_bytes(),
        date.as_bytes(),
    );
    let k_region = hmac_sha256(&k_date, credentials.region.as_bytes());
    let k_service = hmac_sha256(&k_region, service.as_bytes());
    let k_signing = hmac_sha256(&k_service, b"aws4_request");
    let signature = hex::encode(hmac_sha256(&k_signing, string_to_sign.as_bytes()));

    let authorization = format!(
        "AWS4-HMAC-SHA256 Credential={}/{scope}, SignedHeaders={signed_header_names}, Signature={signature}",
        credentials.access_key_id
    );

    let mut headers = vec![
        ("authorization".to_string(), authorization),
        ("x-amz-content-sha256".to_string(), payload_hash),
        ("x-amz-date".to_string(), amz_date),
    ];
    if let Some(token) = &credentials.session_token {
        headers.push(("x-amz-security-token".to_string(), token.clone()));
    }

    SignedRequest { headers }
}

#[cfg(test)]
mod tests {
    use super::*;
    use time::macros::datetime;

    fn test_credentials() -> AwsCredentials {
        // Canonical example credentials from the AWS SigV4 documentation.
        AwsCredentials {
            region: "us-east-1".into(),
            access_key_id: "AKIDEXAMPLE".into(),
            secret_access_key: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY".into(),
            session_token: None,
        }
    }

    #[test]
    fn signs_deterministically() {
        let now = datetime!(2026-06-12 12:00:00 UTC);
        let a = sign_request(
            &test_credentials(),
            "s3",
            "PUT",
            "bucket.s3.us-east-1.amazonaws.com",
            "/avatars/user/file.png",
            b"bytes",
            now,
        );
        let b = sign_request(
            &test_credentials(),
            "s3",
            "PUT",
            "bucket.s3.us-east-1.amazonaws.com",
            "/avatars/user/file.png",
            b"bytes",
            now,
        );
        assert_eq!(a.headers, b.headers);

        let auth = &a.headers[0].1;
        assert!(auth.starts_with(
            "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20260612/us-east-1/s3/aws4_request"
        ));
        assert!(auth.contains("SignedHeaders=host;x-amz-content-sha256;x-amz-date"));
    }

    #[test]
    fn signature_changes_with_body() {
        let now = datetime!(2026-06-12 12:00:00 UTC);
        let a = sign_request(&test_credentials(), "s3", "PUT", "h", "/k", b"one", now);
        let b = sign_request(&test_credentials(), "s3", "PUT", "h", "/k", b"two", now);
        assert_ne!(a.headers[0].1, b.headers[0].1);
    }

    #[test]
    fn encodes_path_segments() {
        assert_eq!(uri_encode_path("/a b/ç.png"), "/a%20b/%C3%A7.png");
        assert_eq!(uri_encode_path("/plain/path.png"), "/plain/path.png");
    }
}
