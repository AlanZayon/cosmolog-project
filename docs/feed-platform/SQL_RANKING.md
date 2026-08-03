# SQL Feed Ranking (MVP)

Production baseline for `FEATURE_FEED_SOURCE=sql`. This is **not** a Feed Platform phase advance — the engine (Phase E) stays untouched. See [PHASE_STATUS.md](./PHASE_STATUS.md).

## Why

Early product traffic is small; Redis workers / RabbitMQ are overhead. `public.get_feed` remains the serving path, but the old score was effectively **recency + magic offsets** (and treated owned universes as followed). This MVP adds real ranking signals while keeping the `GET /feed` JSON contract unchanged.

## Formula (stories)

All terms are roughly normalized to `[0, 1]` (or a small constant), then summed:

```text
score =
  w_fresh          * 0.5^(age_hours / half_life_hours)
+ w_follow         * followed_not_owned          -- universe_follows only; ownership ≠ follow
+ w_engagement     * ln(1 + 2*likes + 3*comments) / ln(41)
+ w_engagement_72h * ln(1 + 2*likes_72h + 3*comments_72h) / ln(11)
+ w_own            * is_own_story                -- default negative
- w_seen           * min(ln(1 + delivery_count) / ln(6), 1)
+ w_jitter         * daily_jitter(viewer, item)
```

Second pass over the candidate pool:

```text
- author_penalty   * min(row_number_by_author - 1, 3)
- universe_penalty * min(row_number_by_universe - 1, 3)
```

### Arcs / universes

| Type | Tier offset | Eligibility |
|------|-------------|-------------|
| `story` | 0 | all |
| `arc` | `tier_arc` (−0.30) | ≥2 stories and latest story ≤60 days |
| `universe` | `tier_universe` (−0.45) | ≥1 story; **not** followed and **not** owned by viewer |

Shaping in the plpgsql loop (after scoring):

- max 2 consecutive non-story items
- no arc/universe cards in the first 2 slots
- arc cap ≈ `max(2, limit/6)`, universe cap ≈ `max(1, limit/8)`

### Daily jitter

Deterministic within a UTC day (stable across refreshes; reshuffles tomorrow):

```sql
hashtext(viewer || ':' || item_id || ':' || YYYY-MM-DD) → [0, 1]
```

### Anti-repeat (`feed_deliveries`)

Authenticated feeds upsert served `(user_id, item_type, item_id)` after policy. `delivery_count` increments at most once per hour to avoid refresh spam. Rows older than 30 days are pruned at API startup.

Env: `FEED_SQL_DELIVERY_LOG` (default `true`).

## Weights (`feed_metadata`)

Key: **`weights.sql_feed`** (do not reuse `weights.global` — that is for `feed-rank`).

Defaults:

| Key | Default |
|-----|---------|
| `freshness` | 1.0 |
| `half_life_hours` | 30.0 |
| `following` | 1.2 |
| `engagement` | 0.7 |
| `engagement_72h` | 0.5 |
| `own` | −0.7 |
| `seen` | 0.45 |
| `jitter` | 0.06 |
| `author_penalty` | 0.18 |
| `universe_penalty` | 0.10 |
| `tier_arc` | −0.30 |
| `tier_universe` | −0.45 |

### Tuning cheat-sheet (no deploy)

```sql
UPDATE feed_metadata
SET value = jsonb_set(value, '{seen}', '0.25'::jsonb),
    version = version + 1,
    updated_at = now()
WHERE key = 'weights.sql_feed';

-- Or replace the whole object:
UPDATE feed_metadata
SET value = '{ ... }'::jsonb, version = version + 1, updated_at = now()
WHERE key = 'weights.sql_feed';
```

`get_feed` reads weights on each call (COALESCE to defaults if the row is missing).

## Implementation map

| Piece | Location |
|-------|----------|
| Table + indexes + default weights | `apps/api/migrations/20260803192839_feed_deliveries_and_ranking_indexes.sql` |
| `get_feed` v2 | `apps/api/migrations/20260803192840_get_feed_v2_ranking.sql` |
| Delivery log + prune | `apps/api/src/feed/sql_gateway.rs` |
| Tests | `apps/api/tests/api_feed_ranking.rs` |

## Follow-ups (explicitly out of scope)

- Cursor pagination / infinite scroll on Home.
- Mirroring this formula into `crates/feed-core` ranking before flipping `FEATURE_FEED_SOURCE=engine` in production.
- Client-side impression tracking (today `feed_deliveries` is a serve-side proxy).
