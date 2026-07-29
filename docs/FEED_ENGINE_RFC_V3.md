# Feed Engine — RFC v3 (implementation gate)

This is the **canonical pre-implementation gate** for the Cosmolog Feed Platform.

- **Baseline runtime map:** RFC v2 (Feed Platform decomposition, Feature Store, hybrid fan-out, dual-read). Keep as design reference; do not re-litigate settled items mid-phase.
- **Deltas & urgency tags:** RFC v3 (Candidate Sources, Feature Registry, Feed Gateway, Policy facade, EventBus port, pragmatic broker).
- **Execution:** skill `cosmolog-feed-platform` + subagent `feed-phase-gate` + [`PHASE_STATUS.md`](./feed-platform/PHASE_STATUS.md).

## Pre-code checklist (obrigatório)

- [ ] `feed-contracts`: EventBus port, CandidateSource, PolicyDecision, FeatureRegistry schema, FeedGateway API, VectorSearch stub
- [ ] Broker for A–C: NATS JetStream **or** RabbitMQ (document in PHASE_STATUS); Redpanda only at scale / Phase D
- [ ] CODEOWNERS or owners noted for feed modules
- [ ] Failure/fallback matrix understood (bus / redis-serving / FS / candidate / rank / materializer / scheduler)
- [ ] FeedResponseV1 frozen (`GET /feed` JSON shape) + contract tests when Gateway lands

## Phase map

| Phase | Goal |
|-------|------|
| DOC | This file + PHASE_STATUS |
| A | Foundation: contracts, outbox, stubs, Gateway passthrough — **SQL feed unchanged** |
| B | Feature workers + FS + Metadata + CandidateSource/Mixer — **SQL feed unchanged** |
| C | Rank + Materializer + shadow/canary |
| D | Late scale (split bins, Redpanda, Graph, ANN) — explicit ask only |

## Explicitly out of scope until D / millions

Graph Platform service, ANN/Milvus prod, Feast/Tecton, per-source microservices, Redpanda day-1, Feed Gateway as separate HTTP service.

## Agent loop

```text
Read PHASE_STATUS → implement current phase only → verify → feed-phase-gate → PASS → advance
```

Detailed checklists: `.cursor/skills/cosmolog-feed-platform/phases.md`
