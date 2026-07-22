---
name: cosmolog-ui-next
description: Implements Cosmolog Next.js UI using page-components, lib/api clients, shadcn/Radix components, and i18n translations. Use when building pages, components, auth UI, or frontend-only changes under src/.
---

# Cosmolog UI (Next.js)

## Structure

1. Add or update logic in `src/page-components/` (or `src/components/<feature>/`).
2. Keep `src/app/**/page.tsx` as a thin re-export (`"use client"` when needed).
3. Call the API only through `src/lib/api/*` (proxy) or `authFetch` for `/api/auth/*`.
4. Reuse `src/components/ui/*` — do not invent a parallel component kit.

## i18n

- Every user-visible string → `src/i18n/translations.ts` for `pt`, `en`, `ja`, `es`.
- Use `useLanguage` / existing translation helpers.

## Auth / session

- No tokens in JS state beyond `PublicSession`.
- Session via `GET /api/auth/session`; cookies are server-side.
- Middleware cookie checks are UX only; API remains authority.

## Data fetching

Default to `useState`/`useEffect` + `lib/api` like neighboring pages. Do not add React Query unless the target file already uses it.

## Next 16

Read `node_modules/next/dist/docs/` before using unfamiliar App Router APIs.
