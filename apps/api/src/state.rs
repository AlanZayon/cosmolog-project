use std::sync::Arc;

use anyhow::Result;
use sqlx::PgPool;

use crate::auth::{JwtSigner, TokenValidator};
use crate::config::{Config, GoogleOAuthConfig};
use crate::domain::activity_notifications::ActivityNotificationEventBus;
use crate::domain::notifications::NotificationEventBus;
use crate::infra::aws::AwsCredentials;
use crate::infra::email::{EmailSender, LogEmailSender, SesEmailSender};
use crate::infra::http_client::build_http_client;
use crate::infra::storage::{DisabledStorage, ObjectStorage, S3Storage};

/// Auth flow settings shared with route handlers.
#[derive(Clone)]
pub struct AuthSettings {
    pub require_email_confirmation: bool,
    pub app_public_url: String,
    pub google: Option<GoogleOAuthConfig>,
}

/// Image storage settings (S3/CloudFront public URLs).
#[derive(Clone)]
pub struct StorageSettings {
    /// Public base URL serving uploaded objects (no trailing slash).
    pub public_base_url: Option<String>,
    /// Allowed URL prefixes for stored images (S3 + optional legacy Supabase).
    pub allowed_image_prefixes: Arc<Vec<String>>,
}

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub jwt: Arc<dyn TokenValidator>,
    pub signer: Arc<JwtSigner>,
    pub email: Arc<dyn EmailSender>,
    pub storage: Arc<dyn ObjectStorage>,
    pub http: reqwest::Client,
    pub auth: AuthSettings,
    pub storage_settings: StorageSettings,
    pub notification_events: NotificationEventBus,
    pub activity_notification_events: ActivityNotificationEventBus,
}

fn auth_settings(config: &Config) -> AuthSettings {
    AuthSettings {
        require_email_confirmation: config.require_email_confirmation,
        app_public_url: config.app_public_url.clone(),
        google: config.google.clone(),
    }
}

fn storage_settings(config: &Config) -> StorageSettings {
    StorageSettings {
        public_base_url: config.s3_public_base_url.clone(),
        allowed_image_prefixes: Arc::new(config.image_url_prefixes()),
    }
}

impl AppState {
    /// Local in-memory notification bus, log email sender and disabled storage
    /// (tests and single-instance dev without AWS/Redis).
    pub fn new(pool: PgPool, jwt: Arc<dyn TokenValidator>, config: &Config) -> Self {
        Self {
            pool,
            jwt,
            signer: Arc::new(JwtSigner::from_secret(config.auth_jwt_secret.as_bytes())),
            email: Arc::new(LogEmailSender),
            storage: Arc::new(DisabledStorage),
            http: build_http_client(),
            auth: auth_settings(config),
            storage_settings: storage_settings(config),
            notification_events: NotificationEventBus::new_local(),
            activity_notification_events: ActivityNotificationEventBus::new_local(),
        }
    }

    /// Production startup: SES/S3 when configured, Redis subscriber when
    /// `REDIS_URL` is configured.
    pub async fn try_new(
        pool: PgPool,
        jwt: Arc<dyn TokenValidator>,
        config: &Config,
    ) -> Result<Self> {
        let notification_events = match config.redis_url.as_deref() {
            Some(redis_url) => {
                tracing::info!(
                    event = "notifications.realtime.redis_enabled",
                    "notification realtime using redis pub/sub"
                );
                NotificationEventBus::connect(redis_url).await?
            }
            None => {
                tracing::info!(
                    event = "notifications.realtime.local_only",
                    "notification realtime using in-memory bus (single instance)"
                );
                NotificationEventBus::new_local()
            }
        };

        let activity_notification_events = match config.redis_url.as_deref() {
            Some(redis_url) => {
                tracing::info!(
                    event = "activity_notifications.realtime.redis_enabled",
                    "activity notification realtime using redis pub/sub"
                );
                ActivityNotificationEventBus::connect(redis_url).await?
            }
            None => {
                tracing::info!(
                    event = "activity_notifications.realtime.local_only",
                    "activity notification realtime using in-memory bus (single instance)"
                );
                ActivityNotificationEventBus::new_local()
            }
        };

        let aws_credentials = AwsCredentials::from_env();

        let email: Arc<dyn EmailSender> = match (config.ses_from_email.clone(), &aws_credentials) {
            (Some(from), Some(credentials)) => {
                tracing::info!(event = "email.ses_enabled", "auth emails via Amazon SES");
                Arc::new(SesEmailSender::new(credentials.clone(), from))
            }
            (Some(_), None) => {
                anyhow::bail!(
                    "SES_FROM_EMAIL is set but AWS credentials are missing (AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)"
                );
            }
            (None, _) => {
                tracing::warn!(
                    event = "email.log_only",
                    "SES_FROM_EMAIL not set; auth emails will only be logged"
                );
                Arc::new(LogEmailSender)
            }
        };

        let storage: Arc<dyn ObjectStorage> = match (config.s3_bucket.clone(), &aws_credentials) {
            (Some(bucket), Some(credentials)) => {
                tracing::info!(
                    event = "storage.s3_enabled",
                    bucket = %bucket,
                    "image uploads via Amazon S3"
                );
                Arc::new(S3Storage::new(credentials.clone(), bucket))
            }
            (Some(_), None) => {
                anyhow::bail!(
                    "S3_BUCKET is set but AWS credentials are missing (AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)"
                );
            }
            (None, _) => {
                tracing::warn!(
                    event = "storage.disabled",
                    "S3_BUCKET not set; image uploads are disabled"
                );
                Arc::new(DisabledStorage)
            }
        };

        Ok(Self {
            pool,
            jwt,
            signer: Arc::new(JwtSigner::from_secret(config.auth_jwt_secret.as_bytes())),
            email,
            storage,
            http: build_http_client(),
            auth: auth_settings(config),
            storage_settings: storage_settings(config),
            notification_events,
            activity_notification_events,
        })
    }
}
