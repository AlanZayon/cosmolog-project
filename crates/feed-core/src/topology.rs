//! RabbitMQ topology for Feed Platform.

pub const FEED_EXCHANGE: &str = "cosmolog.domain";
pub const COMMANDS_EXCHANGE: &str = "cosmolog.commands";
pub const FEATURES_QUEUE: &str = "q.feed.features";
pub const RANK_QUEUE: &str = "q.feed.rank";
pub const FEATURES_RK: &str = "domain.#";
pub const RANK_DOMAIN_RK: &str = "domain.#";
pub const RANK_COMMAND_RK: &str = "feed.rebuild.#";
pub const DLX: &str = "cosmolog.dlx";
pub const DLQ: &str = "q.feed.dlq";

use std::time::Duration;

use anyhow::Context;
use lapin::options::{ExchangeDeclareOptions, QueueBindOptions, QueueDeclareOptions};
use lapin::types::{AMQPValue, FieldTable, LongString};
use lapin::{Channel, Connection, ConnectionProperties, ExchangeKind};

pub async fn connect(amqp_url: &str) -> anyhow::Result<Connection> {
    Connection::connect(amqp_url, ConnectionProperties::default())
        .await
        .context("connect AMQP")
}

/// Connect with exponential backoff (capped at `max_backoff`).
/// Logs `feed.amqp.reconnect` on each failed attempt.
pub async fn connect_with_retry(
    amqp_url: &str,
    max_backoff: Duration,
) -> anyhow::Result<Connection> {
    let mut backoff = Duration::from_millis(500);
    let mut attempt: u32 = 0;
    loop {
        attempt += 1;
        match connect(amqp_url).await {
            Ok(conn) => {
                if attempt > 1 {
                    tracing::info!(
                        event = "feed.amqp.reconnect",
                        attempt,
                        "AMQP connected after retry"
                    );
                }
                return Ok(conn);
            }
            Err(e) => {
                tracing::warn!(
                    event = "feed.amqp.reconnect",
                    attempt,
                    backoff_ms = backoff.as_millis() as u64,
                    error = %e,
                    "AMQP connect failed; retrying"
                );
                tokio::time::sleep(backoff).await;
                backoff = (backoff * 2).min(max_backoff);
            }
        }
    }
}

pub async fn declare_topology(channel: &Channel) -> anyhow::Result<()> {
    channel
        .exchange_declare(
            DLX,
            ExchangeKind::Fanout,
            ExchangeDeclareOptions {
                durable: true,
                ..ExchangeDeclareOptions::default()
            },
            FieldTable::default(),
        )
        .await?;
    channel
        .queue_declare(
            DLQ,
            QueueDeclareOptions {
                durable: true,
                ..QueueDeclareOptions::default()
            },
            FieldTable::default(),
        )
        .await?;
    channel
        .queue_bind(
            DLQ,
            DLX,
            "",
            QueueBindOptions::default(),
            FieldTable::default(),
        )
        .await?;

    channel
        .exchange_declare(
            FEED_EXCHANGE,
            ExchangeKind::Topic,
            ExchangeDeclareOptions {
                durable: true,
                ..ExchangeDeclareOptions::default()
            },
            FieldTable::default(),
        )
        .await?;
    channel
        .exchange_declare(
            COMMANDS_EXCHANGE,
            ExchangeKind::Topic,
            ExchangeDeclareOptions {
                durable: true,
                ..ExchangeDeclareOptions::default()
            },
            FieldTable::default(),
        )
        .await?;

    let mut args = FieldTable::default();
    args.insert(
        "x-dead-letter-exchange".into(),
        AMQPValue::LongString(LongString::from(DLX)),
    );
    channel
        .queue_declare(
            FEATURES_QUEUE,
            QueueDeclareOptions {
                durable: true,
                ..QueueDeclareOptions::default()
            },
            args.clone(),
        )
        .await?;
    channel
        .queue_bind(
            FEATURES_QUEUE,
            FEED_EXCHANGE,
            FEATURES_RK,
            QueueBindOptions::default(),
            FieldTable::default(),
        )
        .await?;

    channel
        .queue_declare(
            RANK_QUEUE,
            QueueDeclareOptions {
                durable: true,
                ..QueueDeclareOptions::default()
            },
            args,
        )
        .await?;
    channel
        .queue_bind(
            RANK_QUEUE,
            FEED_EXCHANGE,
            RANK_DOMAIN_RK,
            QueueBindOptions::default(),
            FieldTable::default(),
        )
        .await?;
    channel
        .queue_bind(
            RANK_QUEUE,
            COMMANDS_EXCHANGE,
            RANK_COMMAND_RK,
            QueueBindOptions::default(),
            FieldTable::default(),
        )
        .await?;

    Ok(())
}

pub use FEED_EXCHANGE as DOMAIN_EXCHANGE;
