# Feed Platform broker — Phase A

Phase A uses `InMemoryEventBus`, a process-local fake bus behind the
`feed_contracts::EventBus` port. The API outbox relay polls `event_outbox` every
500 ms, publishes to this port, then marks successfully published rows.

RabbitMQ may replace this adapter later without changing producers or the
transactional outbox. Redpanda and Kafka are intentionally not part of Phase A.
