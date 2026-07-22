---
name: cosmolog-api-rust
description: Implements Cosmolog Rust/Axum routes, domain repositories, auth extractors, sqlx migrations, and API tests. Use when working under apps/api, adding endpoints, changing authz, or creating database migrations.
---

# Cosmolog API (Rust)

## When adding an endpoint

1. Domain types + repository methods under `apps/api/src/domain/<area>/`.
2. Handler in `apps/api/src/routes/` using `AuthUser` or `OptionalAuth`.
3. Register route in `routes/mod.rs` / `app.rs`.
4. Return `Result<Json<T>, AppError>`; keep JSON error shape `{ "error": ... }`.
5. Add tests in `apps/api/tests/api_*.rs` or `repositories_*.rs`.

## Migrations

```bash
cd apps/api
sqlx migrate add describe_your_change
```

Only edit files under `apps/api/migrations/`. Never `supabase/migrations/`.

## Authz checklist

- [ ] Correct extractor (required vs optional)
- [ ] Ownership / scope checks (stories ↔ universe/arc)
- [ ] Image URLs via `url_validation`
- [ ] Status codes match existing patterns (401 vs 404)

## Verify

```bash
cd apps/api
docker compose -f docker-compose.test.yml up -d
export TEST_DATABASE_URL=postgres://cosmolog:cosmolog@127.0.0.1:5433/cosmolog_test
cargo test
# optional CI parity: ./scripts/ci-test.sh
```

## References

- `apps/api/README.md`
- `apps/api/docs/AUTHZ.md` (cross-check code)
- `apps/api/docs/TESTING_PLAN.md`
