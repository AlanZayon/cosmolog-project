---
name: cosmolog-fullstack
description: Implements Cosmolog features end-to-end across sqlx migration, Rust API, Next BFF lib/api wrappers, page-components, and i18n. Use when adding or changing a product feature that touches UI and API, or when the user asks for a fullstack change.
---

# Cosmolog fullstack feature

## Workflow

Copy and track:

```text
- [ ] 1. Domain + authz (who owns? public read?)
- [ ] 2. Migration in apps/api/migrations/ if schema changes
- [ ] 3. Rust domain + route + AppError
- [ ] 4. Wrapper in src/lib/api/ (+ Api* types)
- [ ] 5. UI in page-components / components
- [ ] 6. i18n keys in translations.ts (pt|en|ja|es)
- [ ] 7. API tests + npm run lint / build
```

## Hard rules

- Browser → `/api/proxy` or `/api/auth` only (cookies httpOnly).
- Do not merge avisos vs activity notifications; follows ≠ alert subscriptions.
- Prefer skill `cosmolog-api-rust` / `cosmolog-ui-next` for deep work in one layer.
- Finish with skill `cosmolog-qa` checks.
- Feed Platform / feed-engine / outbox ranking work: use skill `cosmolog-feed-platform` and never advance phases without subagent `feed-phase-gate` PASS (`docs/feed-platform/PHASE_STATUS.md`).

## Key paths

- API: `apps/api/src/routes/`, `apps/api/src/domain/`
- Client: `src/lib/api/`
- UI: `src/page-components/`, `src/app/**/page.tsx` (thin)
- Authz notes: `apps/api/docs/AUTHZ.md` (verify vs code)
- Cutover: `docs/MIGRATION_SUPABASE_TO_AWS.md`
