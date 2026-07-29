<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Cosmolog — agent map

## Stack

| Layer | Location | Tech |
|-------|----------|------|
| Web (BFF) | repo root `src/` | Next.js 16, React 19, Tailwind, Radix/shadcn |
| API | `apps/api/` | Rust, Axum 0.8, sqlx, Postgres |
| Auth | own JWT HS256 | `AUTH_JWT_SECRET` — not Supabase GoTrue |
| Storage / email | AWS SES/S3 in prod; Docker dev: Mailpit + MinIO |
| OAuth | Google in prod; Docker dev: Fake IdP (`apps/fake-idp`) |
| SSE fan-out | Redis | required when `APP_ENV=production` |

## Request path (do not bypass)

```text
Browser → /api/auth/*  (cookies)  ─┐
Browser → /api/proxy/* (Bearer)   ─┼→ Rust :8080 → Postgres / S3 / SES / Redis
```

- Browser never calls Rust with tokens in JS. Use `src/lib/api/*` (`credentials: 'include'`).
- Cookies: `cosmolog_access_token`, `cosmolog_refresh_token` (httpOnly). See `src/lib/server/auth-cookies.ts`.

## Domain

```text
Universe → Arc → Story (short_story | chapters | comic)
                 ├── Chapters + illustrated_blocks
                 └── comic_pages
```

| Concern | Do not confuse with |
|---------|---------------------|
| Avisos (`notifications` + subscriptions) | Activity inbox (`activity_notifications`) |
| `universe_follows` (feed) | `notification_subscriptions` (avisos) |
| Likes / library collections | Follows or alert subscriptions |

## Critical invariants

1. New SQL only in `apps/api/migrations/` (sqlx). `supabase/migrations/` is legacy archive.
2. Authorization is Rust app-layer (`AuthUser` / ownership checks) — do not rely on RLS.
3. Story `universe_id` / `arc_id` must belong to caller as universe owner.
4. Image URLs must pass `domain/url_validation.rs` (S3/CDN; optional `LEGACY_SUPABASE_URL`).
5. Prefer `Api*` types from `src/lib/api/types.ts`. Do not add `@supabase/supabase-js` or store JWT in `localStorage`.
6. Trust `docs/MIGRATION_SUPABASE_TO_AWS.md` over older `docs/MIGRATION.md` / stale README bits.

## Frontend layout

- Thin routes: `src/app/**/page.tsx` → real UI in `src/page-components/`.
- API wrappers: `src/lib/api/` (`client.ts`, `stories.ts`, …).
- i18n: add keys to `src/i18n/translations.ts` (`pt|en|ja|es`).

## Backend layout

```text
apps/api/src/routes/   # thin handlers
apps/api/src/domain/   # models, repos, validation
apps/api/src/auth/     # JWT extractors
apps/api/src/infra/    # db, aws, email, storage
```

## Verify before done

```bash
npm run lint
API_INTERNAL_URL=http://127.0.0.1:8080 npm run build

cd apps/api
docker compose -f docker-compose.test.yml up -d
export TEST_DATABASE_URL=postgres://cosmolog:cosmolog@127.0.0.1:5433/cosmolog_test
cargo test
# CI parity + coverage gate (≥45%): ./scripts/ci-test.sh
```

## Cursor autonomy pack

| Kind | Path |
|------|------|
| Rules | `.cursor/rules/*.mdc` |
| Skills | `.cursor/skills/cosmolog-*/SKILL.md` |
| Subagents | `.cursor/agents/*.md` |
| MCP | `.cursor/mcp.json` (gitignored). Postgres loads `DATABASE_URL` from `apps/api/.env` via `.cursor/scripts/mcp-postgres.sh`. Template: `.cursor/mcp.example.json` |

When implementing features, follow skill `cosmolog-fullstack`. For schema/auth cutover, use subagent `migration-guardian`.

## Feed Platform (phased)

| Kind | Path |
|------|------|
| Status | `docs/feed-platform/PHASE_STATUS.md` |
| RFC gate | `docs/FEED_ENGINE_RFC_V3.md` |
| Skill | `.cursor/skills/cosmolog-feed-platform/SKILL.md` |
| Checklists | `.cursor/skills/cosmolog-feed-platform/phases.md` |
| Gate subagent | `.cursor/agents/feed-phase-gate.md` |
| Rule | `.cursor/rules/feed-platform-phases.mdc` |

**Loop:** implement only `current_phase` → verify → `feed-phase-gate` must **PASS** before advancing. Do not skip to ranking/materializer or add Redpanda/Graph/ANN until the status file and user allow it.
