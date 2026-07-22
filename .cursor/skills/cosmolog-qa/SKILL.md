---
name: cosmolog-qa
description: Runs Cosmolog verification commands for web lint/build and Rust API tests/coverage. Use when finishing a feature, before a PR, or when the user asks to verify, test, or check CI parity.
---

# Cosmolog QA

## Web

```bash
npm run lint
API_INTERNAL_URL=http://127.0.0.1:8080 npm run build
```

## API

```bash
cd apps/api
docker compose -f docker-compose.test.yml up -d
export TEST_DATABASE_URL=postgres://cosmolog:cosmolog@127.0.0.1:5433/cosmolog_test
cargo test
```

CI parity (coverage ≥ 45% lines, excludes `main.rs`):

```bash
cd apps/api && ./scripts/ci-test.sh
```

Needs `cargo-llvm-cov` + `llvm-tools-preview`.

## Smoke (dev servers up)

```bash
curl -s http://127.0.0.1:8080/health
curl -s http://127.0.0.1:8080/db/ping
```

## CI workflows to mirror

- `.github/workflows/web-ci.yml`
- `.github/workflows/api-test.yml`
- `.github/workflows/api-deploy.yml` (migrate then Render hook)
- `.github/workflows/security-scan.yml` (gitleaks; no tracked `supabase/.temp`)

## Report format

- Pass / fail per command
- Failing test names or lint rules
- Gaps not covered by automated checks (manual UX, SSE, OAuth)
