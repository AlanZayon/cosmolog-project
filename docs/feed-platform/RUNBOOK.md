# Feed Platform — rollback & dual-read runbook

## `FEATURE_FEED_SOURCE`

| Value | Client sees | Notes |
|-------|-------------|-------|
| `sql` (default) | `get_feed` SQL | Instant rollback |
| `shadow` | SQL | Engine/materializer compared in logs (`feed.shadow.diff`) |
| `canary` | Sticky ~50% engine timeline when present; else SQL | Hash `feed_canary` |
| `engine` | Materialized timeline; SQL fallback with budget | Miss storm protected |

## Rollback (&lt; 1 minute)

1. Set `FEATURE_FEED_SOURCE=sql` and restart API (or redeploy env).
2. Clients immediately use SQL `get_feed` again.
3. Leave outbox/workers running (or pause) — safe either way.

## Fallback budget

Under `canary`/`engine`, SQL fallback is rate-limited per process (`fallback_budget_per_window`). When exceeded, serve empty rather than stampede Postgres.

## Broker (Phase A–C)

`MemoryEventBus` + transactional outbox. Swap via `EventBus` port (NATS/RabbitMQ) without changing domain events. Redpanda = Phase D / scale only.
