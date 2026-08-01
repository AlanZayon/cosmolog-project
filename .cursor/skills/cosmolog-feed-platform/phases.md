# Feed Platform — phase acceptance checklists

Use with skill `cosmolog-feed-platform` and subagent `feed-phase-gate`.
Every item is **blocking** unless marked `(advisory)`.

---

## DOC — bootstrap docs

**Exit when:**

- [ ] `docs/feed-platform/PHASE_STATUS.md` exists and lists `current_phase`
- [ ] `docs/FEED_ENGINE_RFC_V3.md` exists (summary or full RFC v3)
- [ ] Pointer to RFC v2 baseline noted (file or “plan archive”)
- [ ] Pre-code checklist from RFC v3 present in docs (EventBus port, CandidateSource, PolicyDecision, FeatureRegistry, FeedGateway, VectorSearch stub)

**Verify:** files exist; no code required.

**Advance to:** `A`

---

## A — Foundation (obrigatório)

**In scope:** `feed-contracts` (or `crates/feed-contracts`), EventBus port, outbox migration + emit on core writes, Feature Registry stub, Policy facade stub (`AllowAll`), Feed Gateway thin (SQL passthrough), broker NATS **or** RabbitMQ behind port (not Redpanda).

**Out of scope:** ranking, materializer timelines, changing feed UX, Graph/ANN/Feast, per-worker binaries.

**Exit when:**

- [ ] Contracts crate compiles; exports EventBus port, FeatureRegistry schema types, PolicyDecision, CandidateSource traits (can be unused), FeedGateway interface, VectorSearch stub
- [ ] `event_outbox` (or equivalent) migration in `apps/api/migrations/` only
- [ ] At least StoryCreated + UniverseFollowed (+ Liked if cheap) written to outbox in same TX as domain write
- [ ] Relay or in-process publisher can publish to chosen broker **or** tests fake bus (document which)
- [ ] `GET /feed` still calls `get_feed` SQL (Gateway passthrough OK)
- [ ] Policy facade callable from Gateway path with AllowAll
- [ ] Feature registry file/table exists with ≥1 documented feature name
- [ ] No Redpanda/Kafka dependency required to boot API
- [ ] `cargo test` (API) passes with outbox tests
- [ ] `npm run lint` passes if any TS touched; else N/A
- [ ] CODEOWNERS or PHASE_STATUS owners noted for `feed-contracts` `(advisory)`

**Verify commands:**

```bash
cd apps/api && cargo test
# if feed-contracts is separate:
# cargo test -p feed-contracts
npm run lint   # when frontend touched
```

**Advance to:** `B`

---

## B — Feature plane

**In scope:** Feature worker modules, online Feature Store (redis-features or logical DB), Metadata store (PG+cache OK), CandidateSource implementations + Mixer (not necessarily wired to serve path).

**Out of scope:** serving engine feed to users, canary, ANN real index.

**Exit when:**

- [ ] Workers update FS from outbox/bus events (popularity and/or following graph indexes minimum)
- [ ] FS read API used by Mixer/tests (MGET-style); workers are sole writers of feature keys
- [ ] Metadata weights/caps loadable with version id
- [ ] ≥2 CandidateSources + Mixer dedup/cap unit tests
- [ ] Ranking still not required for `GET /feed`
- [ ] `GET /feed` still SQL
- [ ] Idempotency for redelivered events (processed_events or equivalent)
- [ ] `cargo test` green; contract tests for CandidateBatch/Feature schema
- [ ] cosmolog-qa API tests green

**Advance to:** `C`

---

## C — Rank + materialize + dual-read

**In scope:** Ranking multi-stage pipeline, Experiment Manager (sticky hash), Materializer modules (timeline/payload/invalidation), shadow then canary via Feed Gateway, impressions minimum `(advisory if deferred with note)`.

**Exit when:**

- [ ] Scorers pure (no DB in scorer modules) — grep/review gate
- [ ] Materializer writes only to feed-serving redis role
- [ ] `FEATURE_FEED_SOURCE` or Gateway mode: `sql | shadow | canary`
- [ ] Shadow: sampled diff logged; clients still SQL until canary
- [ ] Canary sticky assignment; rollback switch to `sql` documented in runbook snippet
- [ ] Fallback budget if redis miss (no unbounded SQL stampede)
- [ ] Policy Evaluate hooked before serve `(at least stub call site)`
- [ ] `tests/api_feed.rs` still passes in sql mode
- [ ] Integration: event → feature → (rebuild) → redis timeline path tested
- [ ] lint + cargo test (+ build if UI pagination)

**Advance to:** `D` only with user confirmation

---

## D — Late / millions

**Enter only if:** user explicitly requests **and** PHASE_STATUS notes scale trigger.

**May include:** Redpanda migration, split materializer bin, Graph Platform, ANN, History worker bin split.

**Exit:** per-item acceptance defined in the change PR — no automatic advance.

---

## E — Runtime Wiring (MVP integrado)

**Goal:** `StoryCreated → outbox → RabbitMQ → feed-features → FS → feed-rank → Redis → Feed Gateway → GET /feed` with `FEATURE_FEED_SOURCE=engine` on Home.

**API must not** `tokio::spawn` feed workers. Bins: `feed-relay`, `feed-features`, `feed-rank`.

### Gates (every subphase E1–E5)

Before advancing, all must PASS:

| Gate | Check |
|------|-------|
| Build | `cargo build -p cosmolog_api -p feed-relay -p feed-features -p feed-rank` (bins that exist for that subphase) |
| Tests | unit + `cargo test -p feed-contracts` |
| Integration | Postgres (+ Redis/RabbitMQ as required) for that subphase |
| Architecture | no feed worker spawn in API; Gateway is feed read path |
| Performance | smoke `/feed` reasonable when engine; outbox lag not exploding |
| Contract | JSON `{id,type,payload,ranking_score}` matches client |
| Documentation | RUNBOOK + PHASE_STATUS + BROKER updated |
| Acceptance | subphase checklist below + `feed-phase-gate` PASS |

### E1 — RabbitMQ + relay

- [x] RabbitMQ in `docker-compose.dev.yml`
- [x] `RabbitMqEventBus` implements `EventBus`
- [x] Bin `apps/feed-relay` polls outbox → publishes
- [x] API has no feed relay spawn

**Advance to:** E2

### E2 — feed-features + Redis DB1

- [x] Bin `apps/feed-features` consumes domain events
- [x] Feature Store on Redis DB 1
- [x] Likes update features only (no full timeline rebuild)
- [x] Idempotency via `processed_events`

**Advance to:** E3

### E3 — feed-rank + Materializer Redis DB2

- [x] Bin `apps/feed-rank` candidates → ranking → materialize
- [x] Rebuild on StoryCreated / Follow / Unfollow
- [x] Scheduler tick (default 5m) for discovery pools
- [x] Timelines in Redis DB 2 (`feed:user:{id}`)

**Advance to:** E4

### E4 — Gateway engine + hydrate

- [x] Feed Gateway reads Redis timelines; hydrates payload like `get_feed`
- [x] Dev compose `FEATURE_FEED_SOURCE=engine`
- [x] Rollback `FEATURE_FEED_SOURCE=sql` restores SQL feed

**Advance to:** E5

### E5 — Obs + E2E + docs

- [x] Structured logs/metrics for outbox lag, consume, feed hit/miss
- [x] Integration test full path
- [x] RUNBOOK + PHASE_STATUS E done
- [x] Browser Home works on engine (manual acceptance note)

**Exit:** Phase E `done`

---

## Global fail conditions (any phase)

Gate **FAIL** if any:

- Phase scope creep (implemented next phase work “while here”)
- Supabase client / JWT in localStorage / SQL under `supabase/migrations/`
- Plugins/scorers with direct SQL in rank hot path
- `GET /feed` behavior changed before Phase C canary flag (Phase E engine is allowed when E4+)
- Redpanda added in A/B without user override recorded in PHASE_STATUS
- Tests failing or skipped to “make green”
- Phase marked done without invoking `feed-phase-gate`
- Feed worker loops spawned inside `cosmolog_api` main (Phase E+)
