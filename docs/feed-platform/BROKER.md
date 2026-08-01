# Feed Platform broker

## Current (Phase E)

**RabbitMQ** (`rabbitmq:3-management` in `docker-compose.dev.yml`).

| Exchange | Kind | Purpose |
|----------|------|---------|
| `cosmolog.domain` | topic | Domain events from outbox (`domain.#` / `story.created`, …) |
| `cosmolog.commands` | topic | Rebuild commands (`feed.rebuild.#`) |
| `cosmolog.dlx` | fanout | Dead-letter |

| Queue | Binding |
|-------|---------|
| `q.feed.features` | `cosmolog.domain` / `domain.#` |
| `q.feed.rank` | `cosmolog.domain` / `domain.#` + `cosmolog.commands` / `feed.rebuild.#` |
| `q.feed.dlq` | DLX |

Adapter: `feed_core::RabbitMqEventBus` implements `feed_contracts::EventBus`.  
Tests may still use `MemoryEventBus`.

`feed-relay` is the only process that polls `event_outbox` and publishes. The API writes the outbox in the same TX as domain mutations and does **not** spawn a relay loop.

## History

- Phase A–D: `MemoryEventBus` in-process for foundation tests.
- Phase E: RabbitMQ for compose / MVP path.
- Redpanda / Kafka: deferred (scale / Phase F).
