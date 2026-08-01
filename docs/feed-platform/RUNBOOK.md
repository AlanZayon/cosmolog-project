# Feed Platform — rollback & dual-read runbook

## `FEATURE_FEED_SOURCE`

| Value | Client sees | Notes |
|-------|-------------|-------|
| `sql` | `get_feed` SQL | Instant rollback |
| `shadow` | SQL | Engine/materializer compared in logs (`feed.shadow.diff`) |
| `canary` | Sticky ~50% engine timeline when present; else SQL | Hash `feed_canary` |
| `engine` | Redis timeline + hydrate; SQL fallback with budget | **Dev compose default** |

## Redis layout (dev)

| DB | Env | Use |
|----|-----|-----|
| 0 | `REDIS_URL` | SSE fan-out |
| 1 | `REDIS_FEATURES_URL` | Feature Store (`feed-features`) |
| 2 | `REDIS_FEED_URL` | Timelines + payloads (`feed-rank` / Gateway) |

Keys: `feed:user:{uuid}` (ZSET), `payload:item:{type}:{id}` (STRING JSON).

## Workers (separate bins — not inside API)

| Bin | Role |
|-----|------|
| `feed-relay` | Poll `event_outbox` → RabbitMQ `cosmolog.domain` |
| `feed-features` | Consume → Redis Feature Store; idempotent via `processed_events` |
| `feed-rank` | Rebuild timelines on StoryCreated / Follow / Unfollow; scheduler tick; likes ignored for rebuild |

Env: `AMQP_URL=amqp://guest:guest@rabbitmq:5672`.

## Rollback (&lt; 1 minute)

1. Set `FEATURE_FEED_SOURCE=sql` and restart API (or redeploy env).
2. Clients immediately use SQL `get_feed` again.
3. Leave outbox/workers running (or pause) — safe either way.

## Fallback budget

Under `canary`/`engine`, SQL fallback is rate-limited per process (`fallback_budget_per_window`). When exceeded, serve empty rather than stampede Postgres.

## Observability

Look for structured `event=` fields:

- `feed.relay.published`, `feed.outbox.lag`
- `feed.features.applied`, `feed.features.skip_duplicate`
- `feed.rank.rebuild_*`, `feed.scheduler.tick`, `feed.materializer.write`
- `feed.gateway.hit` / `feed.gateway.miss` / `feed.fallback.sql`

## Manual acceptance (Home)

With `docker compose -f docker-compose.dev.yml up`, Home should serve engine timelines once `feed-relay` / `feed-features` / `feed-rank` have processed events. Set `FEATURE_FEED_SOURCE=sql` on `api` and restart to confirm SQL rollback.
