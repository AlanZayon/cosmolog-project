use serde::Serialize;

use super::SupabaseClient;

#[derive(Debug, Serialize)]
pub struct StorageUploadResponse {
    pub path: String,
    pub public_url: String,
}

pub async fn upload(
    client: &SupabaseClient,
    access_token: &str,
    bucket: &str,
    path: &str,
    bytes: Vec<u8>,
    content_type: &str,
) -> Result<StorageUploadResponse, String> {
    let url = format!("{}/storage/v1/object/{}/{}", client.url, bucket, path);

    let res = client
        .http
        .post(&url)
        .header("apikey", &client.anon_key)
        .header("Authorization", format!("Bearer {access_token}"))
        .header("Content-Type", content_type)
        .header("x-upsert", "true")
        .body(bytes)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = res.status();
    let body = res.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(body);
    }

    let public_url = format!(
        "{}/storage/v1/object/public/{}/{}",
        client.url, bucket, path
    );
    Ok(StorageUploadResponse {
        path: path.to_string(),
        public_url,
    })
}
