#[cfg(test)]
mod tests {
    use crate::auth::JwtValidator;
    use crate::config::Config;

    const TOKEN: &str = "eyJhbGciOiJFUzI1NiIsImtpZCI6IjY0NTM2NmJlLTUxNTctNDllMS1iZGE3LWQxYjZjMWE0NjUwZiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3B6cWhlb2NkcGlzdnRrd2dnbWJ2LnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJmMjk0YmYxMC1jMGMzLTRmMTMtODczNS1kZTM1ODYyYWRhZmMiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzc5MzgyNzM4LCJpYXQiOjE3NzkzNzkxMzgsImVtYWlsIjoiYWxhbnpheW9uNzJAZ21haWwuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJlbWFpbCI6ImFsYW56YXlvbjcyQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaG9uZV92ZXJpZmllZCI6ZmFsc2UsInN1YiI6ImYyOTRiZjEwLWMwYzMtNGYxMy04NzM1LWRlMzU4NjJhZGFmYyIsInVzZXJuYW1lIjoiQWxhbiBaYXlvbiJ9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzc5Mzc5MTM4fV0sInNlc3Npb25faWQiOiI1ZjFiOTljNC1hMTkzLTQ2OTEtYTZhYS0xZjJkYTg4NzQ0NGUiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.F4pC7XVwMoRnj9wyEopH03KXej0tQ6gLLaJPy7RI3tK3-1KSG3o1cbphpnRSwTo2_emRUT24O9HZgiKAcIu7Bw";

    fn test_config() -> Config {
        Config {
            host: "127.0.0.1".into(),
            port: 8080,
            database_url: String::new(),
            migrate_database_url: String::new(),
            cors_allowed_origin: "http://localhost:3000".into(),
            run_migrations: false,
            supabase_url: "https://pzqheocdpisvtkwggmbv.supabase.co".into(),
            supabase_jwt_issuer: "https://pzqheocdpisvtkwggmbv.supabase.co/auth/v1".into(),
            supabase_jwks_url: "https://pzqheocdpisvtkwggmbv.supabase.co/auth/v1/.well-known/jwks.json".into(),
            supabase_jwt_audience: "authenticated".into(),
        }
    }

    #[tokio::test]
    async fn validates_supabase_access_token() {
        let jwt = JwtValidator::new(&test_config()).await.expect("jwks");
        let user = jwt.validate(TOKEN).await.expect("validate");
        assert_eq!(
            user.user_id.to_string(),
            "f294bf10-c0c3-4f13-8735-de35862adafc"
        );
    }
}
