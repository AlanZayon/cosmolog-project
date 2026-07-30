# Phase D — late / scale seams

Entered because the implementation plan todos requested Phase D completion.
Scope here is **scaffolding only** — not production Redpanda/ANN.

## Included

| Item | Location |
|------|----------|
| `VectorSearch` / `NoopVectorSearch` | `crates/feed-contracts` |
| Graph FS helpers | `apps/api/src/feed/graph.rs` |
| EventBus port (swap to NATS/RabbitMQ/Redpanda) | `feed_contracts::bus::EventBus` |
| Broker upgrade criteria | lag + analytics volume; see RFC v3 |
| Seam tests | `apps/api/tests/feed_phase_d_seams.rs` |

## Scale trigger (recorded)

User override in `PHASE_STATUS`: complete plan todos including Phase D **scaffolding**.
No production Redpanda / ANN / split materializer binary in this delivery.

## Explicitly NOT enabled

- Redpanda/Kafka dependency in Cargo.toml
- Separate materializer binary
- Milvus / ANN production index
- Graph Platform microservice

## Upgrade path to Redpanda

1. Implement `RedpandaEventBus: EventBus`
2. Set `FEED_BUS=redpanda` (future env)
3. Keep outbox unchanged
4. Dual-publish during migration if needed
