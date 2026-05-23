# Plano de testes automatizados — Cosmolog API (Rust)

Documento de referência para implementar cobertura ideal no backend Axum + sqlx.
Estado base: **~0% de cobertura** (1 teste JWT existente e quebrado).

---

## 1. Objetivos e metas

### Objetivos

- Detectar regressões em validação, autorização e persistência antes do deploy.
- Permitir refatoração segura em `domain/` e `routes/`.
- Rodar a suíte inteira localmente e no CI sem depender de Supabase em produção.

### Metas de cobertura (ideal)

| Camada | Meta | Justificativa |
|--------|------|---------------|
| `domain/*/create.rs`, `update.rs`, `UpsertArcInput` | **≥ 95%** | Lógica pura, barata de testar, alto risco de regressão |
| `error.rs`, `config.rs` (helpers) | **≥ 90%** | Mapeamento HTTP e normalização de URL |
| `auth/` (JWT, extractor, optional) | **≥ 85%** | Segurança; casos felizes e de falha |
| `domain/*/repository.rs` | **≥ 80%** | SQL e regras de ownership no banco |
| `routes/` (handlers HTTP) | **≥ 75%** | Contrato da API |
| `infra/supabase/*` | **≥ 60%** | Mock de HTTP; testar parsing e erros, não o Supabase real |
| `middleware/`, `main.rs` | **≥ 50%** | Smoke tests (request-id, CORS headers) |

**Meta global:** ≥ **80% line coverage** em `apps/api/src/`, excluindo `main.rs`.

Ferramenta sugerida: [`cargo-llvm-cov`](https://github.com/taiki-e/cargo-llvm-cov) ou `tarpaulin`.

---

## 2. Estado atual

| Item | Situação |
|------|----------|
| Testes | ~94 (unit + auth + repos + HTTP API) |
| CI | `.github/workflows/api-test.yml` (Postgres + coverage gate 50%) |
| Cobertura | `cargo llvm-cov` + artefato `lcov.info` no CI |
| Banco de teste | `docker-compose.test.yml` + Postgres no GitHub Actions |

---

## 3. Pré-requisitos arquiteturais (Fase 0)

Antes de escrever testes de HTTP/integração, fazer estes ajustes mínimos.

### 3.1 Extrair `lib.rs`

Hoje o crate é só binário. Para `tests/*.rs` e `TestClient` do Axum:

```
apps/api/
├── src/
│   ├── lib.rs          # pub mod app, auth, config, domain, …
│   └── main.rs         # use cosmolog_api::…; serve(…)
└── tests/
    ├── common/mod.rs
    ├── health.rs
    └── stories_api.rs
```

`lib.rs` reexporta `router()` e tipos necessários aos testes.

### 3.2 Abstrair validação JWT (recomendado)

`JwtValidator` hoje acopla rede (JWKS). Para testes HTTP estáveis:

```rust
#[async_trait]
pub trait TokenValidator: Send + Sync {
    async fn validate(&self, token: &str) -> Result<AuthUser>;
}

// Produção: JwtValidator
// Testes: MockValidator — mapa token → AuthUser ou Err
```

`AppState` passa a usar `Arc<dyn TokenValidator>`. Alternativa mais rápida (menos ideal): header de teste `X-Test-User-Id` gated por `cfg(test)` ou `APP_ENV=test`.

### 3.3 Abstrair Supabase HTTP (opcional na Fase 2)

`SupabaseClient` pode receber `reqwest::Client` injetável ou usar [`wiremock`](https://docs.rs/wiremock) nos testes de `/feed` e `/storage/upload`.

### 3.4 Helpers de config de teste

Centralizar em `tests/common/mod.rs`:

```rust
pub fn test_config() -> Config { … }  // valores dummy, sem rede
pub async fn test_pool() -> PgPool { … }
pub fn test_app(state: AppState, config: &Config) -> Router { … }
```

---

## 4. Pirâmide de testes

```
                    ┌─────────────┐
                    │  E2E API    │  Poucos — fluxos críticos ponta a ponta
                    │  (HTTP+DB)  │
               ┌────┴─────────────┴────┐
               │  Integração repos    │  sqlx + Postgres de teste
               │  + handlers Axum     │
          ┌────┴──────────────────────┴────┐
          │  Unitários puros               │  validate(), error, config, present
          └────────────────────────────────┘
```

| Tipo | Onde | Ferramentas |
|------|------|-------------|
| Unitário | `#[cfg(test)] mod tests` no mesmo arquivo ou `src/**/tests.rs` | `cargo test` nativo |
| Integração DB | `tests/repositories/` | `sqlx`, Postgres, `sqlx migrate run` |
| HTTP API | `tests/api/` | `axum::Router` + `tower::ServiceExt` / `reqwest` contra listener local |
| Contrato externo | `tests/supabase/` | `wiremock` |

---

## 5. Infraestrutura de testes

### 5.1 Dependências (`Cargo.toml`)

```toml
[dev-dependencies]
tokio = { version = "1", features = ["full", "test-util"] }
axum = { version = "0.8", features = ["multipart"] }
tower = { version = "0.5", features = ["util"] }
http-body-util = "0.1"
serde_json = "1.0"
uuid = { version = "1", features = ["v4"] }
wiremock = "0.6"
sqlx = { version = "0.8", features = ["runtime-tokio", "postgres", "uuid", "time", "migrate"] }
# Opcional: testcontainers para CI
# testcontainers = "0.23"
# testcontainers-modules = { version = "0.11", features = ["postgres"] }
```

Para JWT local sem rede: `jsonwebtoken` + par de chaves ES256 gerado em fixture.

### 5.2 Banco de dados de teste

**Problema:** migrations em `apps/api/migrations/` são mostly no-op; schema real está em `supabase/migrations/` com FK para `auth.users`.

**Solução recomendada:** criar `tests/fixtures/schema.sql` — subset do schema `public` **sem** dependência de `auth.users`:

- Tabelas: `profiles`, `universes`, `stories`, `chapters`, `illustrated_blocks`, `comic_pages`, `comments`, `likes`, `arcs`, `universe_follows`, …
- `user_id` / `author_id` / `owner_id` como `UUID NOT NULL` sem FK (suficiente para sqlx da API, que usa conexão direta)

**Opções de execução:**

| Ambiente | Abordagem |
|----------|-----------|
| Local | `docker compose -f docker-compose.test.yml up -d` (Postgres 16) |
| CI | Service container `postgres:16` no GitHub Actions |
| Avançado | `testcontainers` — sobe Postgres por suite |

Variável: `TEST_DATABASE_URL=postgres://cosmolog:cosmolog@localhost:5433/cosmolog_test`

Fluxo no `#[tokio::test]` ou `tests/common`:

1. Conectar em DB admin, `DROP/CREATE DATABASE cosmolog_test`
2. Aplicar `schema.sql`
3. Retornar `PgPool`
4. Entre testes: `TRUNCATE … RESTART IDENTITY CASCADE` ou transação com rollback

### 5.3 Fixtures de dados

`tests/common/fixtures.rs`:

- `seed_user(id, username) → Profile`
- `seed_universe(owner_id) → Universe`
- `seed_story(author_id, universe_id?) → Story`
- `auth_header(user_id) → String` (via mock JWT ou token fixo do mock validator)

### 5.4 Substituir o teste JWT quebrado

Remover dependência de token Supabase hardcoded. Novo approach:

1. Gerar par ES256 em `tests/fixtures/jwks.json`
2. `MockJwksServer` (wiremock) serve JWKS
3. Assinar tokens de teste com claims controlados (`sub`, `exp`, `aud`, `iss`)
4. Casos: token válido, expirado, kid desconhecido, audience errada, sem Bearer header

---

## 6. Plano de implementação por fases

### Fase 0 — Fundação (1–2 dias)

- [ ] Criar `src/lib.rs` + ajustar `main.rs`
- [ ] Adicionar `dev-dependencies`
- [ ] `tests/common/mod.rs` com `test_config()`
- [ ] Corrigir/remover `jwt_test.rs` quebrado
- [ ] `docker-compose.test.yml` + `tests/fixtures/schema.sql`
- [ ] Script `cargo test` passando (mesmo que com 0 asserts novos)
- [ ] Documentar `TEST_DATABASE_URL` no README

**Entregável:** infra pronta, pipeline local `cargo test` verde.

---

### Fase 1 — Unitários puros (2–3 dias) → ~25% cobertura

Prioridade máxima: custo baixo, valor alto.

#### `domain/` — validação de input

| Módulo | Casos de teste |
|--------|----------------|
| `stories/create.rs` | título vazio, >200 chars, tipo inválido, descrição >5000, trim |
| `stories/update.rs` | campos opcionais, título vazio, tipo inválido |
| `universes/create.rs` | título vazio/longo, descrição >2000 |
| `universes/update.rs` | idem |
| `profiles/update.rs` | username vazio/longo/controle, bio >500, avatar_url >2048, nenhum campo |
| `routes/arcs.rs` `UpsertArcInput` | name vazio (extrair validate para domain se possível) |

Padrão de teste:

```rust
#[test]
fn rejects_empty_title() {
    let input = CreateStoryInput { title: "  ".into(), … };
    assert!(matches!(input.validate(), Err(AppError::BadRequest(_))));
}
```

#### `error.rs`

- `from_db` com código PostgreSQL `23505` → `Conflict`
- `IntoResponse` → status 401, 404, 400, 409, 500
- Corpo JSON `{ "error": "…" }`

#### `config.rs`

- `normalize_supabase_database_url`: `:6543` → `:5432`
- `strip_connect_param`: remove `pgbouncer=true`
- `env_bool`: true/false/1/yes

#### `domain/stories/present.rs`

- `attach_profiles`: stories sem profile, batch correto, ordem preservada

**Entregável:** ~40–60 testes unitários, sem DB.

---

### Fase 2 — Auth (2 dias) → ~35% cobertura

| Área | Testes |
|------|--------|
| `JwtValidator` | decode OK, expirado, iss/aud errados, kid missing |
| `AuthUser` extractor | sem header → 401, `Bearer` inválido → 401 |
| `OptionalAuth` | sem token → None; token inválido → 401; token ok → Some |
| JWKS cache | segunda chamada não refetch se kid conhecido; refetch se kid novo |

Usar wiremock + tokens assinados localmente (sem Supabase real).

**Entregável:** auth desacoplado de produção nos testes.

---

### Fase 3 — Repositórios / integração DB (4–5 dias) → ~60% cobertura

Um arquivo de teste por agregado, em `tests/repositories/`:

| Repositório | Cenários principais |
|-------------|---------------------|
| `profiles/repository.rs` | find/update, username duplicado (23505) |
| `universes/repository.rs` | CRUD, update por non-owner (RowNotFound ou 0 rows) |
| `stories/repository.rs` | insert, search, list by universe/arc/author, update ownership |
| `chapters/repository.rs` | ordem chapter_number, unique constraint |
| `blocks/repository.rs` | list/replace por chapter_id |
| `comic_pages/repository.rs` | list/replace/append |
| `comments/repository.rs` | insert + join username |
| `likes/repository.rs` | toggle idempotente |
| `follows/repository.rs` | insert/delete/has_follow |
| `arcs/repository.rs` | CRUD vinculado a universe |

**Entregável:** confiança na camada sqlx.

---

### Fase 4 — Testes HTTP / rotas (4–5 dias) → ~75–80% cobertura

Usar `MockTokenValidator` + pool de teste + `app::router()`.

#### Matriz mínima por rota

| Rota | Auth | Casos |
|------|------|-------|
| `GET /health` | — | 200 |
| `GET /db/ping` | — | 200 com DB; comportamento se DB down (opcional) |
| `GET /auth/me` | JWT | 200 claims; 401 sem token |
| `POST /auth/sign-in` etc. | — | mock Supabase (wiremock) 200/401 |
| `GET /feed` | optional | com/sem token; mock RPC response |
| `POST /storage/upload` | JWT | multipart ok; 401 |
| `GET/PATCH /profiles/me` | JWT | 200; validação 400 |
| `GET /profiles/{username}` | — | 200 / 404 |
| `POST /universes` | JWT | 201; 400 validação |
| `PATCH /universes/{id}` | JWT | owner ok; non-owner 401 |
| `POST/DELETE /universes/{id}/follow` | JWT | follow/unfollow |
| `POST /stories` | JWT | 201; tipos válidos |
| `PATCH /stories/{id}` | JWT | author ok; non-author 401 |
| `GET/PUT /stories/{id}/blocks` | read/JWT | list public; replace auth |
| `GET/POST /stories/{id}/chapters` | read/JWT | idem |
| `GET/POST /stories/{id}/like` | JWT | toggle |
| `GET/POST /stories/{id}/comments` | read/JWT | list/create |
| `POST /universes/{id}/arcs` | JWT | owner only |
| `GET/PATCH/DELETE /arcs/{id}` | read/JWT | owner para mutações |

#### Middleware

- Resposta inclui `x-request-id`
- CORS: preflight OPTIONS com origin permitida

**Entregável:** contrato HTTP documentado por testes.

---

### Fase 5 — CI, coverage gate e manutenção (1–2 dias)

#### GitHub Actions (`.github/workflows/api-test.yml`)

```yaml
# Esboço
jobs:
  test:
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: cosmolog
          POSTGRES_PASSWORD: cosmolog
          POSTGRES_DB: cosmolog_test
        ports: ['5433:5432']
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: cargo test --manifest-path apps/api/Cargo.toml
      - run: cargo llvm-cov --manifest-path apps/api/Cargo.toml --lcov --output-path lcov.info
      # Opcional: gate mínimo 75%
```

#### Convenções

- Testes unitários: colocated `#[cfg(test)]` no módulo
- Integração HTTP/DB: `apps/api/tests/`
- Nomenclatura: `fn rejects_empty_title()` / `async fn create_story_returns_201()`
- Proibido: tokens reais, URLs de produção, dependência de ordem entre testes
- PR: testes novos obrigatórios para bugs (regressão) e features em `domain/` + `routes/`

#### Comandos locais

```bash
cd apps/api
docker compose -f docker-compose.test.yml up -d
export TEST_DATABASE_URL=postgres://cosmolog:cosmolog@localhost:5433/cosmolog_test
cargo test
cargo llvm-cov --html   # relatório visual
```

---

## 7. Mapa de prioridade (risco × esforço)

```
Alto risco, baixo esforço  →  Fase 1 (validate) + error.rs
Alto risco, médio esforço  →  Fase 2 (auth) + Fase 3 (repos stories/universes)
Médio risco, médio esforço →  Fase 4 (routes mutáveis: PATCH, POST, DELETE)
Baixo risco              →  health, db/ping, GETs públicos simples
```

Fluxos críticos de negócio (must-have antes de v1 estável):

1. Criar universe → criar story → adicionar chapters/blocks
2. Autor edita; non-autor recebe 401
3. Like/comment/follow idempotentes
4. Validação de limites de caracteres alinhada ao frontend (`contentLimits.ts`)

---

## 8. Alinhamento frontend ↔ backend

Hoje há divergência de limites:

| Campo | Frontend (`contentLimits.ts`) | Backend (`create.rs`) |
|-------|------------------------------|------------------------|
| story title | 90 | 200 |
| universe description | 1_200 | 2_000 |

**Ação recomendada:** antes ou durante Fase 1, unificar limites e testar os mesmos valores nos dois lados. Os testes backend devem codificar o contrato acordado.

---

## 9. O que não testar (ou testar minimamente)

- `main.rs` — smoke manual basta
- Conexão real com Supabase Auth/Storage em CI (usar wiremock)
- Performance/load (fora do escopo inicial)
- Migrations sqlx em banco Supabase real (usar Postgres local)

---

## 10. Cronograma estimado

| Fase | Duração | Cobertura acumulada |
|------|---------|---------------------|
| 0 — Fundação | 1–2 dias | 0% → infra OK |
| 1 — Unitários | 2–3 dias | ~25% |
| 2 — Auth | 2 dias | ~35% |
| 3 — Repositories | 4–5 dias | ~60% |
| 4 — HTTP routes | 4–5 dias | ~75–80% |
| 5 — CI + gates | 1–2 dias | 80%+ estável |

**Total:** ~3–4 semanas em ritmo part-time, ~1,5–2 semanas full-time.

---

## 11. Checklist de “cobertura ideal” concluída

- [x] `cargo test` verde local e no CI
- [ ] ≥ 80% line coverage em `src/` (exceto `main.rs`) — gate CI inicial em 50%; subir gradualmente
- [x] Zero testes dependendo de rede externa ou credenciais reais
- [x] Toda função `validate()` com casos positivos e negativos
- [x] Toda rota mutável principal com teste de autorização (owner/author)
- [x] Regressão JWT legada substituída por suite estável (wiremock + RSA local)
- [x] README atualizado com instruções de teste e CI
- [x] Coverage report publicado no CI (artefato `lcov.info`)

### Melhorias futuras (pós-Fase 5)

- [ ] Testes HTTP para `/feed` e `/storage/upload` com wiremock Supabase
- [ ] Subir `--fail-under-lines` para 75–80%
- [ ] Badge de coverage (Codecov ou similar)

---

## 12. Próximos passos (pós-implementação)

1. Subir o gate de coverage no workflow (`--fail-under-lines`) conforme a cobertura crescer
2. Adicionar testes wiremock para `/feed` e `/storage/upload`
3. Alinhar limites de validação com o frontend (`contentLimits.ts`)
