# Cosmolog API

Backend HTTP service (Rust + Axum) for domain logic, auth, and data access.

## Prerequisites

- [Rust](https://rustup.rs/) (stable toolchain)
- PostgreSQL connection string from Supabase (see below)
- [sqlx-cli](https://github.com/launchbadge/sqlx/tree/main/sqlx-cli) for creating migrations (optional if you only run the API)

```bash
cargo install sqlx-cli --no-default-features --features rustls,postgres
```

## Setup

```bash
cd apps/api
cp .env.example .env
# Edit .env and set DATABASE_URL (and other vars if needed)
```

Get `DATABASE_URL` from Supabase: **Project Settings → Database → Connection string**. You can paste the **transaction pooler** URI (`:6543`); the API automatically rewrites it to the **session pooler** (`:5432`) because sqlx does not work with transaction-mode pgbouncer. Override with `RUNTIME_DATABASE_URL` if needed.

For **new DDL migrations** (CREATE TABLE, ALTER, etc.), use the **session pooler** (`:5432`) or **direct** connection (`db.<project-ref>.supabase.co`). The API auto-rewrites transaction pooler URLs (`:6543` → `:5432`) for migrations, or set `MIGRATE_DATABASE_URL` explicitly.

## Run

```bash
cargo run
```

The server listens on `API_HOST`:`API_PORT` (default `0.0.0.0:8080`).

With `RUN_MIGRATIONS=true` (default), pending migrations in `migrations/` are applied on startup (via a short-lived pool compatible with Supabase pooler).

## Verify

```bash
curl -s http://127.0.0.1:8080/health
curl -s http://127.0.0.1:8080/db/ping
curl -s http://127.0.0.1:8080/profiles/me -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

`/db/ping` requires a valid `DATABASE_URL` and network access to Supabase.

## Authentication (Supabase JWT)

The API validates Supabase access tokens via JWKS (`/auth/v1/.well-known/jwks.json`).

Protected routes expect:

```http
Authorization: Bearer <supabase_access_token>
```

### Test `/profiles/me`

Returns the row from `public.profiles` for the authenticated user:

```bash
curl -s http://127.0.0.1:8080/profiles/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Test `/auth/me`

1. Log in on the Next.js app (or Supabase dashboard → Auth → Users).
2. In the browser devtools, read the access token from the Supabase session storage, **or** call Supabase Auth from your client and copy `session.access_token`.
3. Call the API:

```bash
curl -s http://127.0.0.1:8080/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Success (`200`):

```json
{ "user_id": "...", "role": "authenticated", "email": "..." }
```

Without a token or with an invalid token → `401` with `{ "error": "unauthorized" }`.

## HTTP API (v1)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | — | Healthcheck |
| GET | `/db/ping` | — | Database ping |
| POST | `/auth/sign-in` | — | Email/password → session JSON |
| POST | `/auth/sign-up` | — | Register (username in metadata) |
| POST | `/auth/refresh` | — | Refresh token → new session |
| GET | `/auth/me` | JWT | Claims from token |
| GET | `/feed` | optional JWT | Home feed (`get_feed` RPC proxy) |
| POST | `/storage/upload` | JWT | Multipart upload to Supabase Storage |
| GET | `/profiles/me` | JWT | Own profile |
| PATCH | `/profiles/me` | JWT | Update username, bio, avatar_url |
| GET | `/profiles/{username}` | — | Public profile by username |
| POST | `/stories` | JWT | Create story (metadata) |
| GET | `/stories/me` | JWT | Own stories (newest first) |
| GET | `/stories/{id}` | — | Story by id |
| PATCH | `/stories/{id}` | JWT | Update story metadata |
| GET/PUT | `/stories/{id}/blocks` | read / JWT | Illustrated blocks (`?chapter_id=`) |
| GET/POST | `/stories/{id}/chapters` | read / JWT | Chapters |
| GET/PUT | `/stories/{id}/comic-pages` | read / JWT | Comic pages |
| GET/POST | `/stories/{id}/comments` | read / JWT | Comments |
| GET/POST | `/stories/{id}/like` | JWT | Like status / toggle |
| PATCH | `/universes/{id}` | JWT | Update universe |
| GET/POST/DELETE | `/universes/{id}/follow` | JWT | Follow status |
| POST | `/universes/{id}/arcs` | JWT | Create arc |
| GET/PATCH/DELETE | `/arcs/{id}` | read / JWT | Arc CRUD |
| GET | `/arcs/{id}/stories` | — | Stories in arc |
| POST | `/universes` | JWT | Create universe |
| GET | `/universes/me` | JWT | Own universes |
| GET | `/universes/{id}` | — | Universe by id |
| GET | `/universes/{id}/stories` | — | Stories in universe (`?type=`) |
| GET | `/universes/{id}/arcs` | — | Arcs in universe |
| GET | `/stories/search` | — | Search by title (`?q=`) |
| GET | `/profiles/user/{user_id}` | — | Profile by auth user id |
| GET | `/profiles/batch` | — | Profiles batch (`?ids=`) |

### Update profile

```bash
curl -s -X PATCH http://127.0.0.1:8080/profiles/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"Alan Zayon","bio":"Hello"}'
```

### Using auth in handlers

Import `AuthUser` as an Axum extractor on any route:

```rust
use crate::auth::AuthUser;

pub async fn my_handler(user: AuthUser) -> impl IntoResponse {
    // user.user_id, user.role, user.email
}
```

## Database migrations

### Two sources of schema history

| Location | Tool | Status |
|----------|------|--------|
| `supabase/migrations/` | Supabase CLI | Legacy — already applied to your project |
| `apps/api/migrations/` | sqlx | **New migrations go here** |

The first sqlx migration (`20260517120000_baseline.sql`) is a no-op that registers sqlx tracking on databases that already have the Supabase schema. It does not recreate tables.

### Create a new migration

```bash
cd apps/api
sqlx migrate add describe_your_change
# Edit migrations/<timestamp>_describe_your_change.sql
```

### Apply migrations manually

```bash
cd apps/api
# Uses DATABASE_URL from environment or .env (dotenvy loads .env for cargo run only;
# for sqlx-cli, export DATABASE_URL or use dotenv)
export $(grep -v '^#' .env | xargs)
sqlx migrate run
sqlx migrate info
```

### Disable migrations on startup

Set in `.env`:

```env
RUN_MIGRATIONS=false
```

Use this in production if you prefer a deploy step (`sqlx migrate run`) instead of applying on every instance start.

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_HOST` | No | `0.0.0.0` | Bind address |
| `API_PORT` | No | `8080` | Bind port |
| `DATABASE_URL` | Yes | — | PostgreSQL URI (`:6543` rewritten to `:5432` for sqlx) |
| `RUNTIME_DATABASE_URL` | No | session pooler derived from `DATABASE_URL` | Override runtime pool |
| `MIGRATE_DATABASE_URL` | No | session pooler derived from `DATABASE_URL` | Override migrations connection |
| `CORS_ALLOWED_ORIGIN` | No | `http://localhost:3000` | Allowed browser origin |
| `RUN_MIGRATIONS` | No | `true` | Apply sqlx migrations on startup |
| `SUPABASE_URL` | Yes | — | Project URL (same as `NEXT_PUBLIC_SUPABASE_URL`) |
| `SUPABASE_JWT_AUDIENCE` | No | `authenticated` | Expected JWT `aud` claim |
| `RUST_LOG` | No | `cosmolog_api=info,...` | Log filter (see tracing) |
