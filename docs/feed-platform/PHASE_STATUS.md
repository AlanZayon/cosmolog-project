# Feed Platform — phase status

> Single source of truth for the gated implementation loop.
> Agents: read this first; advance **only** after `feed-phase-gate` → **PASS**.

## Current

| Field | Value |
|-------|-------|
| `current_phase` | `A` |
| `phase_state` | `pending` |
| `last_gate_verdict` | `PASS` (DOC bootstrap) |
| `last_gate_at` | 2026-07-28 |
| `broker_choice` | `undecided` (NATS JetStream \| RabbitMQ — decide in Phase A) |
| `user_overrides` | — |

Valid `current_phase`: `DOC` \| `A` \| `B` \| `C` \| `D`  
Valid `phase_state`: `pending` \| `in_progress` \| `blocked` \| `done`

## History

| Phase | Verdict | Date | Notes |
|-------|---------|------|-------|
| DOC | PASS | 2026-07-28 | RFC v3 + PHASE_STATUS + rule/skill/gate agent loop |

## Advance protocol

1. Set `phase_state: in_progress` when starting work.
2. Implement only that phase (see `.cursor/skills/cosmolog-feed-platform/phases.md`).
3. Invoke subagent **feed-phase-gate**.
4. On **PASS**: set phase `done`, append History row, set `current_phase` to next, `phase_state: pending`.
5. On **FAIL**: set `blocked`, do not change `current_phase`.

## Next phase map

`DOC` → `A` → `B` → `C` → (`D` only with explicit user ask)
