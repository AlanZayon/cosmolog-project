use std::sync::Arc;

use anyhow::Result;
use feed_contracts::bus::{EventBus, MemoryEventBus};
use feed_contracts::gateway::FeedGateway;
use feed_contracts::registry::FeatureRegistry;
use feed_core::RedisTimelineStore;
use sqlx::PgPool;

use crate::auth::{JwtSigner, TokenValidator};
use crate::config::{Config, GoogleOAuthConfig};
use crate::domain::activity_notifications::ActivityNotificationEventBus;
use crate::domain::notifications::NotificationEventBus;
use crate::feed::{
    build_feed_gateway_with_redis, load_feature_registry, parse_feed_source_mode, MemoryFeatureStore,
    TimelineMaterializer,
};
use crate::infra::aws::AwsCredentials;
use crate::infra::email::{EmailSender, LogEmailSender, SesEmailSender, SmtpEmailSender};
use crate::infra::http_client::build_http_client;
use crate::infra::storage::{DisabledStorage, ObjectStorage, S3Storage};

#[derive(Clone)]
pub struct AuthSettings {
    pub require_email_confirmation: bool,
    pub app_public_url: String,
    pub google: Option<GoogleOAuthConfig>,
}

#[derive(Clone)]
pub struct StorageSettings {
    pub public_base_url: Option<String>,
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
    pub feed_gateway: Arc<dyn FeedGateway>,
    pub event_bus: Arc<dyn EventBus>,
    pub feature_registry: Arc<FeatureRegistry>,
    pub feature_store: MemoryFeatureStore,
    pub materializer: TimelineMaterializer,
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

fn feed_platform_parts(
    pool: &PgPool,
    config: &Config,
    redis_timelines: Option<RedisTimelineStore>,
) -> (
    Arc<dyn FeedGateway>,
    Arc<dyn EventBus>,
    Arc<FeatureRegistry>,
    MemoryFeatureStore,
    TimelineMaterializer,
) {
    let materializer = TimelineMaterializer::new();
    let mode = parse_feed_source_mode(&config.feed_source_mode);
    let feature_store = MemoryFeatureStore::new();
    (
        build_feed_gateway_with_redis(pool.clone(), mode, materializer.clone(), redis_timelines),
        // API does not run feed workers; MemoryEventBus kept for tests / optional in-process use.
        Arc::new(MemoryEventBus::new()),
        Arc::new(load_feature_registry()),
        feature_store,
        materializer,
    )
}

impl AppState {
    pub fn new(pool: PgPool, jwt: Arc<dyn TokenValidator>, config: &Config) -> Self {
        let (feed_gateway, event_bus, feature_registry, feature_store, materializer) =
            feed_platform_parts(&pool, config, None);
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
            feed_gateway,
            event_bus,
            feature_registry,
            feature_store,
            materializer,
        }
    }

    pub async fn try_new(
        pool: PgPool,
        jwt: Arc<dyn TokenValidator>,
        config: &Config,
    ) -> Result<Self> {
        let notification_events = match config.redis_url.as_deref() {
            Some(redis_url) => NotificationEventBus::connect(redis_url).await?,
            None => NotificationEventBus::new_local(),
        };

        let activity_notification_events = match config.redis_url.as_deref() {
            Some(redis_url) => ActivityNotificationEventBus::connect(redis_url).await?,
            None => ActivityNotificationEventBus::new_local(),
        };

        let aws_credentials = AwsCredentials::from_env();

        let email: Arc<dyn EmailSender> = if let Some(smtp_url) = &config.smtp_url {
            let from = config
                .ses_from_email
                .clone()
                .unwrap_or_else(|| "noreply@localhost".into());
            Arc::new(
                SmtpEmailSender::from_url(smtp_url, &from)
                    .map_err(|e| anyhow::anyhow!("SMTP_URL config error: {e}"))?,
            )
        } else {
            match (config.ses_from_email.clone(), &aws_credentials) {
                (Some(from), Some(credentials)) => {
                    Arc::new(SesEmailSender::new(credentials.clone(), from))
                }
                (Some(_), None) => {
                    anyhow::bail!(
                        "SES_FROM_EMAIL is set but AWS credentials are missing (AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)"
                    );
                }
                (None, _) => Arc::new(LogEmailSender),
            }
        };

        let storage: Arc<dyn ObjectStorage> = match (config.s3_bucket.clone(), &aws_credentials) {
            (Some(bucket), Some(credentials)) => {
                if let Some(endpoint) = &config.s3_endpoint {
                    Arc::new(S3Storage::with_endpoint(
                        credentials.clone(),
                        bucket,
                        endpoint.clone(),
                    ))
                } else {
                    Arc::new(S3Storage::new(credentials.clone(), bucket))
                }
            }
            (Some(_), None) => {
                anyhow::bail!(
                    "S3_BUCKET is set but AWS credentials are missing (AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)"
                );
            }
            (None, _) => Arc::new(DisabledStorage),
        };

        let redis_timelines = match config.redis_feed_url.as_deref() {
            Some(url) => match RedisTimelineStore::connect(url).await {
                Ok(store) => Some(store),
                Err(e) => {
                    tracing::warn!(
                        event = "feed.redis.connect_failed",
                        error = %e,
                        "REDIS_FEED_URL set but connect failed; engine will miss"
                    );
                    None
                }
            },
            None => None,
        };

        let (feed_gateway, event_bus, feature_registry, feature_store, materializer) =
            feed_platform_parts(&pool, config, redis_timelines);
        tracing::info!(
            event = "feed.platform.ready",
            feed_source = %config.feed_source_mode,
            features = feature_registry.features.len(),
            redis_feed = config.redis_feed_url.is_some(),
            "feed platform initialized (Gateway read; workers are separate bins)"
        );

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
            feed_gateway,
            event_bus,
            feature_registry,
            feature_store,
            materializer,
        })
    }
}
