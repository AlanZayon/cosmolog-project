---
name: cosmolog-feed-platform
description: >-
  Implements Cosmolog Feed Platform (RFC v2/v3) in gated phases A→B→C→D with
  mandatory verification before advancing. Use when the user asks to build the
  feed plan, implement feed-engine, outbox, Feature Store, CandidateSource,
  Ranking, Materializer, Feed Gateway, Policy facade, or continue the next feed
  phase.
---

# Cosmolog Feed Platform (gated loop)

## Authority

| Doc | Role |
|-----|------|
| Plan / RFC v3 | Architecture deltas + urgency tags |
| RFC v2 (baseline) | Runtime map (platforms, hybrid fan-out, dual-read) |
| [phases.md](phases.md) | Per-phase acceptance checklists |
| [docs/feed-platform/PHASE_STATUS.md](../../../docs/feed-platform/PHASE_STATUS.md) | **Current phase — single source of truth** |

Do **not** re-litigate OVER-ENGINEERING items. Do **not** skip phases.

## Loop (every session)

Copy and track:

```text
Feed loop:
- [ ] 1. Read PHASE_STATUS.md → note current_phase + blockers
- [ ] 2. Read phases.md section for that phase only
- [ ] 3. Implement ONLY that phase (smallest vertical slice)
- [ ] 4. Run phase verification commands from phases.md
- [ ] 5. Run cosmolog-qa checks that the phase requires
- [ ] 6. Invoke subagent feed-phase-gate with phase id + summary of changes
- [ ] 7. If PASS → update PHASE_STATUS (phase done, advance current)
- [ ] 8. If FAIL → fix; do NOT advance; re-run gate
- [ ] 9. Stop and report; ask user before starting next phase unless they said "continue until B/C"
```

**Forbidden:** marking todos complete / advancing phase on self-assessment alone.

## Phase map (short)

| Phase | Goal | `/feed` |
|-------|------|---------|
| **DOC** | Persist RFC pointers + status file | unchanged |
| **A** | Contracts, EventBus port, outbox, registry stub, Policy stub, Gateway thin passthrough | **SQL only** |
| **B** | Feature workers modules, FS online, Metadata store, CandidateSource+Mixer | SQL only |
| **C** | Ranking pipeline, Exp Manager, Materializer modules, shadow→canary | dual-read then canary |
| **D** | Split bins / Redpanda / Graph / ANN — only with explicit user ask + scale evidence | hardened |

## Cross-cutting invariants (all phases)

- Browser → BFF only; no JWT in JS storage.
- Outbox in same TX as domain writes (when emitting).
- Scorers/plugins: **no DB/Redis I/O** (Feature Store reads only at rank time).
- Events → Feature Workers → FS → Candidates → Rank → Materializer (never Event→Plugin).
- Redis roles: do not put feed-serving keys on SSE redis (split logical DB min.).
- `migration-guardian` mindset for any SQL.
- Prefer existing `apps/api` patterns; new code under `apps/feed-*` / `crates/feed-*` as phased.

## When user says "build the plan"

1. If `PHASE_STATUS` missing → run **DOC** first.
2. Else continue **current_phase** via the loop above.
3. After PASS, **pause** and summarize unless user explicitly chained phases (e.g. "finish A and B").

## Delegation

| Need | Use |
|------|-----|
| Phase acceptance | subagent `feed-phase-gate` |
| API/domain routes | skill `cosmolog-api-rust` / subagent `api-engineer` |
| UI feed client | skill `cosmolog-ui-next` (Phase C+) |
| Lint/test/CI | skill `cosmolog-qa` |
| SQL/auth cutover | subagent `migration-guardian` |

## Report format (end of turn)

```text
## Feed phase
current: A|B|C|D
gate: PASS|FAIL|not-run
advanced: yes|no

## Done this turn
- …

## Blockers
- …

## Next
- …
```
