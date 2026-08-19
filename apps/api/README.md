# Cosmolog API

Backend HTTP service (Rust + Axum) for domain logic, auth, and data access.

## Prerequisites

- [Rust](https://rustup.rs/) (stable toolchain)
- PostgreSQL connection string (own/managed Postgres)
- Redis (optional locally; required in production for multi-instance notification SSE)
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

Point `DATABASE_URL` at your PostgreSQL instance. Legacy Supabase **transaction pooler** URIs (`:6543`) are still auto-rewritten to the session pooler (`:5432`) during the transition period; override with `RUNTIME_DATABASE_URL`/`MIGRATE_DATABASE_URL` if needed.

See [docs/MIGRATION_SUPABASE_TO_AWS.md](../../docs/MIGRATION_SUPABASE_TO_AWS.md) for the Supabase → own Postgres + AWS migration runbook (users, passwords, image URLs).

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

## Tests

```bash
cd apps/api
cargo test                    # unit + integration (no network)
```

Auth tests sign HS256 tokens with the shared test secret (`tests/common/jwt.rs`) — no credentials required.

### Postgres (repository + HTTP API tests)

```bash
docker compose -f docker-compose.test.yml up -d
export TEST_DATABASE_URL=postgres://cosmolog:cosmolog@127.0.0.1:5433/cosmolog_test
# On WSL2 / low RAM (~8GB), keep parallelism low to avoid the distro OOM-crashing:
CARGO_BUILD_JOBS=2 RUST_TEST_THREADS=2 cargo test
```

Without Postgres, unit/auth tests still run; repository and API tests skip with a message.

If Ubuntu/WSL dies when Docker + `cargo test` run together, set `%UserProfile%\.wslconfig` (`memory=5GB`, `swap=4GB`, `processors=4`), then `wsl --shutdown` from Windows PowerShell. Stop `docker-compose.dev.yml` before tests; only the Postgres service in `docker-compose.test.yml` is needed (capped at 256MB).

### CI parity (local)

```bash
cd apps/api
./scripts/ci-test.sh          # cargo test + coverage gate (needs Postgres + llvm-tools)
                              # defaults CARGO_BUILD_JOBS=2 RUST_TEST_THREADS=2
```

Requires [cargo-llvm-cov](https://github.com/taiki-e/cargo-llvm-cov) and the `llvm-tools-preview` Rust component:

```bash
rustup component add llvm-tools-preview
cargo install cargo-llvm-cov
```

Coverage HTML report:

```bash
cd apps/api
cargo llvm-cov report --html
# open target/llvm-cov/html/index.html
```

### Continuous integration

GitHub Actions workflow [`.github/workflows/api-test.yml`](../../.github/workflows/api-test.yml) runs on changes under `apps/api/`:

- PostgreSQL 16 service container
- Full test suite (~94 tests)
- Line coverage via `cargo llvm-cov` (minimum **45%**, excluding `main.rs`; raise over time)
- Uploads `lcov.info` as a workflow artifact

See [docs/TESTING_PLAN.md](docs/TESTING_PLAN.md) for the full testing roadmap.

Weekly volume checks (SQL + log filters, no dashboards): [docs/OPS.md](../../docs/OPS.md).

## Docker

### Production image

```bash
cd apps/api
docker build -t cosmolog-api .
docker run --rm -p 8080:8080 --env-file .env cosmolog-api
```

Requires `DATABASE_URL` and `AUTH_JWT_SECRET`; SES/S3/Google vars enable email, uploads and OAuth (see `.env.example`).

### Dev stack (with frontend)

From the repo root:

```bash
cp apps/api/.env.docker.example apps/api/.env.docker
docker compose -f docker-compose.dev.yml up --build
```

The API uses local Postgres, Redis, Mailpit (SMTP), MinIO (S3), and Fake IdP (OAuth) from compose when running the full dev stack.

## Deploy (Render)

The API is configured for [Render](https://render.com) via [`render.yaml`](../../render.yaml). The Docker build context is the **repo root** (`dockerfilePath: ./apps/api/Dockerfile`, `dockerContext: .`) so path dependencies under `crates/` and sibling feed crates resolve.

**If you already have a Render service:** sync env vars from `render.yaml` in the dashboard, or reconnect the Blueprint so the new context / `FEATURE_FEED_SOURCE` apply. After the workspace Dockerfile change, trigger a **Manual Deploy** (Clear build cache) once.

**Feed in production:** `FEATURE_FEED_SOURCE=sql` is set in the Blueprint. Feed workers, RabbitMQ, and Redis feature/timeline DBs are **not** deployed — see [`docs/feed-platform/RUNBOOK.md`](../../docs/feed-platform/RUNBOOK.md).

**Redis for SSE:** provision a free [Render Key Value](https://render.com/docs/key-value) instance (25 MB is enough for pub/sub) and set `REDIS_URL` to its internal URL. Required when `APP_ENV=production`. Do **not** set `AMQP_URL`, `REDIS_FEED_URL`, or `REDIS_FEATURES_URL` until you cut over the feed engine.

**Required env vars** (Render Dashboard → Service → Environment):

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL URI |
| `AUTH_JWT_SECRET` | HMAC secret for access tokens (>= 32 chars) |
| `APP_PUBLIC_URL` | Public web app URL (links in auth emails) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Direct Google OAuth |
| `AWS_REGION` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | AWS credentials for SES + S3 |
| `SES_FROM_EMAIL` | Verified SES sender for auth emails |
| `S3_BUCKET` / `S3_PUBLIC_BASE_URL` | Image upload bucket + public base URL (CloudFront) |
| `LEGACY_SUPABASE_URL` | Optional: keep accepting old Supabase image URLs |
| `CORS_ALLOWED_ORIGIN` | Frontend URL (e.g. `https://your-app.vercel.app`) |
| `REDIS_URL` | Redis / Key Value URI for notification SSE. Required when `APP_ENV=production`. |
| `FEATURE_FEED_SOURCE` | Blueprint sets `sql`. Do not set to `engine` without workers + Redis DB2. |

Render sets `PORT` automatically; the API reads `PORT` or `API_PORT`.

Local image smoke test:

```bash
docker build -f apps/api/Dockerfile -t cosmolog-api:test .
```

### Automated deploy (after CI)

Workflow [`.github/workflows/api-deploy.yml`](../../.github/workflows/api-deploy.yml) runs on **every push** to `main`/`master` (no path filters): sqlx migrations on **HMG + production**, then **both** Render deploy hooks.

Workflow [`.github/workflows/api-test.yml`](../../.github/workflows/api-test.yml) is separate (path-filtered API tests only).

GitHub → **Settings** → **Secrets and variables** → **Actions**:

| Secret | Purpose |
|--------|---------|
| `MIGRATE_DATABASE_URL` | Direct Postgres URI for **HMG** (homologation) |
| `MIGRATE_DATABASE_URL_PRODUCTION` | Direct Postgres URI for **production** |
| `RENDER_DEPLOY_HOOK_URL` | Render Deploy Hook for the **HMG** API service |
| `RENDER_DEPLOY_HOOK_URL_PRODUCTION` | Render Deploy Hook for the **production** API service |

All four secrets are **required** — missing any fails the workflow. Use the session/direct Postgres endpoint (not a transaction pooler).

**Vercel vs Actions:** Vercel deploys the Next.js app on every git push by itself. Migrations + Render live in GitHub Actions → open [Actions](https://github.com/AlanZayon/cosmolog-project/actions) and look for **Migrate + Deploy API**. If *no* workflows appear (not even Security scan), enable Actions under **Settings → Actions → General → Allow all actions**.

1. Render Dashboard → **HMG** API service → **Settings** → **Deploy Hook** → `RENDER_DEPLOY_HOOK_URL`
2. Render Dashboard → **production** API service → **Settings** → **Deploy Hook** → `RENDER_DEPLOY_HOOK_URL_PRODUCTION`
3. Disable Render **Auto-Deploy** on both if you only want deploys post-migrate (optional)

Manual run: Actions → **Migrate + Deploy API** → **Run workflow**.

`/db/ping` requires a valid `DATABASE_URL`.

## Authentication (own JWT)

The API issues and validates its own HS256 access tokens (signed with `AUTH_JWT_SECRET`). Refresh tokens are opaque, stored hashed in `auth_refresh_tokens` and rotated on every refresh. Passwords use Argon2.

Protected routes expect:

```http
Authorization: Bearer <access_token>
```

### Test `/profiles/me`

Returns the row from `public.profiles` for the authenticated user:

```bash
curl -s http://127.0.0.1:8080/profiles/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Test `/auth/me`

1. Sign in via `POST /auth/sign-in` (or through the Next.js app) and copy `access_token` from the response.
2. Call the API:

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
| POST | `/auth/sign-up` | — | Register (creates user + profile) |
| POST | `/auth/refresh` | — | Refresh token → new session (rotation) |
| POST | `/auth/sign-out` | — | Revoke a refresh token |
| POST | `/auth/oauth/exchange` | — | Google OAuth code → session |
| POST | `/auth/confirm-email` | — | Confirm email with one-time token |
| POST | `/auth/forgot-password` | — | Send password reset email (SES) |
| POST | `/auth/reset-password` | — | Set new password → session |
| GET | `/auth/me` | JWT | Claims from token |
| GET | `/feed` | optional JWT | Home feed (`get_feed` SQL function) |
| POST | `/storage/upload` | JWT | Multipart upload to Amazon S3 |
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
| `RUN_MIGRATIONS` | No | `true` (local dev) | Apply sqlx migrations on startup. **Production (Render): `false`** — run migrations in CI/deploy via `MIGRATE_DATABASE_URL` + `MIGRATE_DATABASE_URL_PRODUCTION` secrets. |
| `AUTH_JWT_SECRET` | Prod | dev fallback | HMAC secret for HS256 access tokens (>= 32 chars) |
| `REQUIRE_EMAIL_CONFIRMATION` | No | `true` in prod | Require email confirmation before sign-in |
| `APP_PUBLIC_URL` | No | `CORS_ALLOWED_ORIGIN` | Public web URL used in email links |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | No | — | Google or Fake IdP OAuth (set both) |
| `OAUTH_TOKEN_URL` | No | Google token URL | Token endpoint (use Fake IdP URL locally) |
| `OAUTH_ISSUER` | No | Google issuers | Expected `iss` on ID token |
| `AWS_REGION` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | With SES/S3 | — | AWS credentials (SigV4); also used for MinIO |
| `SMTP_URL` | No | — | SMTP relay (e.g. `smtp://mailpit:1025`); takes priority over SES |
| `SES_FROM_EMAIL` | No | — | From address (SES or SMTP); unset + no SMTP = emails only logged |
| `S3_BUCKET` | Prod | — | S3/MinIO bucket for image uploads |
| `S3_ENDPOINT` | No | — | Custom S3 API endpoint (MinIO path-style). When unset, AWS virtual-host |
| `S3_PUBLIC_BASE_URL` | Prod | — | Public base URL for uploaded images (CloudFront/S3/MinIO) |
| `LEGACY_SUPABASE_URL` | No | — | Accept old Supabase Storage image URLs (transition) |
| `RUST_LOG` | No | `cosmolog_api=info,sqlx=warn` | Log filter (see [Structured logging](#structured-logging)) |
| `LOG_FORMAT` | No | `pretty` (dev) / `json` (prod) | Log output format: `json` or `pretty` |
| `APP_ENV` | No | `development` | Environment label included in logs (`development`, `production`, …). When `production`, `REDIS_URL` is required. |
| `REDIS_URL` | No* | — | Redis URI for notification SSE fan-out across API instances (`redis://127.0.0.1:6379`). Optional in development; **required when `APP_ENV=production`**. Without Redis, realtime notifications work on a single instance only (in-memory bus). |

## Structured logging

The API emits structured logs via [`tracing`](https://docs.rs/tracing). Each HTTP request gets a correlation id (`x-request-id` header, generated if missing) and a span with `request_id`, `method`, `path`, and `user_id` (when authenticated).

Common fields:

| Field | Description |
|-------|-------------|
| `event` | Event name (e.g. `story.created`, `http.request.completed`) |
| `request_id` | Correlation id for the request |
| `user_id` | Authenticated user (when available) |
| `service` | Always `cosmolog-api` |
| `env` | Value of `APP_ENV` |
| `status`, `latency_ms` | HTTP response metadata |

Examples:

```bash
# Human-readable logs (default in development)
LOG_FORMAT=pretty cargo run

# JSON logs for production / log aggregators
APP_ENV=production LOG_FORMAT=json cargo run

# Verbose debug (includes JWT validation failures)
RUST_LOG=cosmolog_api=debug,sqlx=warn cargo run
```
