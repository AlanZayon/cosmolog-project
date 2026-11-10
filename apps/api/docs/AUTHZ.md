# Authorization model (Cosmolog API)

This document describes **who can do what** on the Rust API (`apps/api`). Enforcement is application-layer only: the API connects to PostgreSQL with a privileged role and does **not** rely on Supabase RLS for these routes.

## Authentication

| Mechanism | Details |
|-----------|---------|
| JWT Bearer | `Authorization: Bearer <access_token>` from Supabase GoTrue |
| Required role | `authenticated` only (`apps/api/src/auth/jwt.rs`) |
| Optional routes | Invalid/missing Bearer → anonymous reader (`OptionalAuth`) |
| BFF (production) | Next.js reads httpOnly cookies and forwards Bearer server-side |

## Resource ownership

| Resource | Owner field | Write rule |
|----------|-------------|------------|
| Profile | `profiles.user_id` | User may update **own** profile only |
| Universe | `universes.owner_id` | Owner CRUD; public read by id |
| Arc | via `arcs.universe_id` → universe owner | Universe owner CRUD; public read |
| Codex lore / timeline / maps / gallery / TOC | via `universe_id` → universe owner | Owner write; public read of **published** entries (drafts owner-only) |
| Story | `stories.author_id` | Author update/delete; public read |
| Chapter / blocks / comic pages | via story author | Story author only |
| Comment | any authenticated user | Create on any story; no edit/delete API yet |
| Like / follow | any authenticated user | Toggle on any public story/universe |
| Notification subscription | `notification_subscriptions.subscriber_id` | Subscriber manages own subscriptions; cannot subscribe to self |
| Notification | `notifications.recipient_id` | Recipient may list and consume **own** notifications only |
| Storage upload | path prefix `{user_id}/` | Authenticated; path forced to caller's id |

## Story scope (`universe_id` / `arc_id`)

When creating or updating a story with `universe_id` and/or `arc_id`:

1. If `universe_id` is set → universe must exist and `owner_id == caller`
2. If `arc_id` is set → arc must exist; its universe must belong to caller
3. If both are set → arc's `universe_id` must match `universe_id`

Implementation: `apps/api/src/domain/stories/scope.rs`

Cross-user assignment returns **401 Unauthorized** (not 404) to avoid leaking existence in some paths.

## Public read vs protected write

| Endpoint pattern | Anonymous | Authenticated |
|------------------|-----------|---------------|
| `GET /stories/{id}` | ✅ | ✅ |
| `GET /stories/search` | ✅ | ✅ |
| `GET /profiles/search` | ✅ | ✅ |
| `GET /universes/{id}` | ✅ | ✅ |
| `GET /universes/{id}/codex/*` (published) | ✅ | ✅ (+ drafts if owner) |
| `POST/PATCH/PUT/DELETE …/codex…` | ❌ 401 | ✅ universe owner |
| `POST /stories` | ❌ 401 | ✅ (own scope) |
| `PATCH /stories/{id}` | ❌ 401 | ✅ author only |
| `PUT /stories/{id}/blocks` | ❌ 401 | ✅ author only |
| `POST /storage/upload` | ❌ 401 | ✅ own path prefix |
| `GET/POST/DELETE /profiles/{username}/notification-subscription` | ❌ 401 | ✅ (not own profile; profile needs ≥1 story on subscribe) |
| `GET/POST/DELETE /universes/{id}/notification-subscription` | ❌ 401 | ✅ (not universe owner) |
| `GET /notifications`, `GET /notifications/unread-count`, `GET /notifications/stream` (SSE) | ❌ 401 | ✅ own inbox only |
| `POST /notifications/{id}/consume` | ❌ 401 | ✅ own notification only |

`universe_follows` (feed) and `notification_subscriptions` (in-app notifications) are separate features.

## Input validation (abuse prevention)

| Area | Limit / rule |
|------|----------------|
| Image URLs (avatar, covers, comic, image blocks) | HTTPS Supabase public storage URL only (`domain/url_validation.rs`) |
| Storage path | `{user_id}/…`, no `..` |
| Comments | max 4 000 chars |
| Blocks | max 200 blocks, 10 000 chars each; types `text` \| `image` |
| Search | max 100 chars |
| Profile batch | max 50 ids |
| Auth routes | rate limited per IP |

## Error semantics (authorization)

| Situation | Typical status |
|-----------|----------------|
| Missing/invalid token on protected route | **401** |
| Valid token, not resource owner | **401** (stories) or **404** (universes patch — hides existence) |
| Invalid input / URL | **400** |
| Resource not found (public read) | **404** |

## Middleware (Next.js)

Browser routes `/profile`, `/create`, `/universes/create`, `/universe/*/create-story` redirect to `/login` when the access-token cookie is absent. This is **UX only**; the API remains the authority.

## Tests

Integration coverage lives in `apps/api/tests/`:

- `api_stories.rs` — author-only patch, foreign universe on create
- `api_universes.rs` — owner-only patch
- `api_authz.rs` — extended matrix (arc scope, blocks URL, blocks author)
- `api_notifications.rs` — subscriptions, fan-out on story create, thresholds, consume

Run: `cd apps/api && cargo test` (requires `TEST_DATABASE_URL` / Postgres).

## Future hardening

- Comment edit/delete with author checks
- Database role with least privilege (not `postgres` superuser)
- RLS as defense-in-depth if direct Supabase access is ever enabled
