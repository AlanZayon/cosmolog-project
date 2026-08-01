//! RabbitMQ EventBus adapter.

use async_trait::async_trait;
use feed_contracts::bus::{EventBus, EventPublishError};
use feed_contracts::events::EventEnvelope;
use lapin::options::BasicPublishOptions;
use lapin::BasicProperties;
use lapin::Channel;
use serde_json::Value;

use crate::topology::{connect, declare_topology, FEED_EXCHANGE};

pub struct RabbitMqEventBus {
    channel: Channel,
}

impl RabbitMqEventBus {
    pub async fn connect(amqp_url: &str) -> anyhow::Result<Self> {
        let conn = connect(amqp_url).await?;
        let channel = conn.create_channel().await?;
        declare_topology(&channel).await?;
        Ok(Self { channel })
    }

    pub fn channel(&self) -> &Channel {
        &self.channel
    }
}

#[async_trait]
impl EventBus for RabbitMqEventBus {
    async fn publish(&self, envelope: EventEnvelope<Value>) -> Result<(), EventPublishError> {
        publish_envelope(&self.channel, &envelope)
            .await
            .map_err(|e| EventPublishError::Transport(e.to_string()))
    }
}

pub fn routing_key_for_event_type(event_type: &str) -> String {
    if event_type.starts_with("domain.") {
        event_type.to_string()
    } else {
        format!("domain.{event_type}")
    }
}

pub async fn publish_envelope(
    channel: &Channel,
    envelope: &EventEnvelope<Value>,
) -> anyhow::Result<()> {
    let payload = serde_json::to_vec(envelope)?;
    let rk = routing_key_for_event_type(&envelope.event_type);
    channel
        .basic_publish(
            FEED_EXCHANGE,
            &rk,
            BasicPublishOptions::default(),
            &payload,
            BasicProperties::default()
                .with_content_type("application/json".into())
                .with_delivery_mode(2),
        )
        .await?
        .await?;
    tracing::info!(
        event = "feed.rabbit.publish",
        routing_key = %rk,
        event_type = %envelope.event_type,
        event_id = %envelope.event_id,
        "published domain event"
    );
    Ok(())
}

pub async fn publish_raw(
    channel: &Channel,
    exchange: &str,
    routing_key: &str,
    body: &[u8],
) -> anyhow::Result<()> {
    channel
        .basic_publish(
            exchange,
            routing_key,
            BasicPublishOptions::default(),
            body,
            BasicProperties::default()
                .with_content_type("application/json".into())
                .with_delivery_mode(2),
        )
        .await?
        .await?;
    Ok(())
}
