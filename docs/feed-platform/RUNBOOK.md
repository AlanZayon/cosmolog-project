# Feed Platform — rollback & dual-read runbook

## Production (current state)

| Piece | Production | Notes |
|-------|------------|-------|
| `FEATURE_FEED_SOURCE` | **`sql`** (set explicitly in `render.yaml`) | Clients always see `get_feed` SQL |
| `feed-relay` / `feed-features` / `feed-rank` | **Not deployed** | Dev-only via `docker-compose.dev.yml` |
| RabbitMQ | **Not provisioned** | Dev compose only |
| Redis DB1 / DB2 | **Not used** | No `REDIS_FEED_URL` / `REDIS_FEATURES_URL` in Render |
| Redis DB0 (`REDIS_URL`) | **Required** | SSE fan-out — use a free Render Key Value instance |

Phase E runtime wiring is complete and verified in **dev**. Production stays on SQL until `get_feed` becomes a bottleneck. Enabling the engine is then a deploy/config change, not a rewrite.

### `event_outbox` without a relay

The API still writes domain events to `event_outbox` in the same TX as mutations. With no `feed-relay` in production, rows accumulate with `published_at IS NULL`.

Risks:

1. Slow table growth on free Postgres (Neon).
2. **Stampede on cutover** — the first time `feed-relay` starts, it would drain months of unpublished events and fan out rebuilds.

### Cutover checklist (engine on)

Before starting `feed-relay` against a production database that has been writing outbox rows without a consumer:

```sql
-- Mark all pending rows published so the relay does not replay history.
UPDATE event_outbox SET published_at = now() WHERE published_at IS NULL;
```

Optional prune of already-published rows (after cutover is stable):

```sql
DELETE FROM event_outbox
WHERE published_at IS NOT NULL
  AND published_at < now() - interval '30 days';
```

Then:

1. Provision RabbitMQ + Redis (DB1 features, DB2 timelines) reachable from workers.
2. Deploy `feed-relay`, `feed-features`, `feed-rank` (see root `Dockerfile.worker`).
3. Set `REDIS_FEED_URL` on the API; leave `FEATURE_FEED_SOURCE=sql` initially.
4. Flip `FEATURE_FEED_SOURCE` → `shadow` → `canary` → `engine` per dual-read table below.
5. Instant rollback: `FEATURE_FEED_SOURCE=sql`.

---

## `FEATURE_FEED_SOURCE`

| Value | Client sees | Notes |
|-------|-------------|-------|
| `sql` | `get_feed` SQL | Instant rollback; **production default** |
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

Resilience (dev): workers reconnect on AMQP disconnect (`feed.amqp.reconnect`), honor SIGTERM, and use `restart: unless-stopped` in compose. Prefetch: features=10, rank=1.

Release images (not wired to Render):

```bash
docker build --build-arg BIN=feed-relay -f Dockerfile.worker -t feed-relay .
docker build --build-arg BIN=feed-features -f Dockerfile.worker -t feed-features .
docker build --build-arg BIN=feed-rank -f Dockerfile.worker -t feed-rank .
```

## Known issues (deferred)

Tracked for a future hardening pass — **not** blocking SQL-mode production:

1. **`story.created` fanout** — `feed-rank` rebuilds up to `CELEBRITY_FOLLOWER_CAP` (2000) users **sequentially inside one AMQP handler** before ack. Should publish per-user `rebuild_user` commands instead.
2. **Redis N+1 in rebuild** — `rebuild_user_timeline` does ~1100 sequential Redis round-trips (no pipeline / `HMGET`). Incompatible with command-metered Redis SaaS; fine for self-hosted Redis in compose/VM.

## Rollback (&lt; 1 minute)

1. Set `FEATURE_FEED_SOURCE=sql` and restart API (or redeploy env).
2. Clients immediately use SQL `get_feed` again.
3. Leave outbox/workers running (or pause) — safe either way.

## Fallback budget

Under `canary`/`engine`, SQL fallback is rate-limited per process (`fallback_budget_per_window`). When exceeded, serve empty rather than stampede Postgres.

## Observability

Look for structured `event=` fields:

- `feed.relay.published`, `feed.outbox.lag`, `feed.amqp.reconnect`
- `feed.features.applied`, `feed.features.skip_duplicate`
- `feed.rank.rebuild_*`, `feed.scheduler.tick`, `feed.materializer.write`
- `feed.gateway.hit` / `feed.gateway.miss` / `feed.fallback.sql`

## Manual acceptance (Home)

With `docker compose -f docker-compose.dev.yml up`, Home should serve engine timelines once `feed-relay` / `feed-features` / `feed-rank` have processed events. Set `FEATURE_FEED_SOURCE=sql` on `api` and restart to confirm SQL rollback.
