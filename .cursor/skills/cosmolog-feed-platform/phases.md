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

## Global fail conditions (any phase)

Gate **FAIL** if any:

- Phase scope creep (implemented next phase work “while here”)
- Supabase client / JWT in localStorage / SQL under `supabase/migrations/`
- Plugins/scorers with direct SQL in rank hot path
- `GET /feed` behavior changed before Phase C canary flag
- Redpanda added in A/B without user override recorded in PHASE_STATUS
- Tests failing or skipped to “make green”
- Phase marked done without invoking `feed-phase-gate`
