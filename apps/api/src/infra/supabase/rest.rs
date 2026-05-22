use super::SupabaseClient;

pub async fn get_feed(
    client: &SupabaseClient,
    access_token: Option<&str>,
    limit: i32,
) -> Result<serde_json::Value, String> {
    let url = format!("{}/rest/v1/rpc/get_feed", client.url);
    let mut req = client
        .http
        .post(&url)
        .header("apikey", &client.anon_key)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({ "limit_count": limit }));

    if let Some(token) = access_token {
        req = req.header("Authorization", format!("Bearer {token}"));
    }

    let res = req.send().await.map_err(|e| e.to_string())?;
    let status = res.status();
    let body = res.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(body);
    }
    serde_json::from_str(&body).map_err(|e| format!("{e}: {body}"))
}
