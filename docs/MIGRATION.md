# Migração Next.js → API Rust (Cosmolog)

O **browser não usa mais** `@supabase/supabase-js`. Tudo passa por `NEXT_PUBLIC_API_URL`.

## Arquitetura

```text
Browser (Next.js)
  └── API Rust (apps/api)
        ├── PostgreSQL (sqlx)
        ├── Supabase Auth (proxy: sign-in / sign-up / refresh)
        ├── Supabase Storage (proxy: upload com JWT do usuário)
        └── Supabase RPC get_feed (proxy com JWT opcional)
```

## Variáveis

| Onde | Variável |
|------|----------|
| Next `.env.local` | `NEXT_PUBLIC_API_URL` |
| API `apps/api/.env` | `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `CORS_ALLOWED_ORIGIN`, `SUPABASE_JWT_AUDIENCE` |

Sessão no browser: `localStorage` (`cosmolog_session`), gerida por `src/lib/auth/session.ts`.

## Rotas principais da API

- Auth: `POST /auth/sign-in`, `/auth/sign-up`, `/auth/refresh`, `GET /auth/me`
- Feed: `GET /feed`
- Storage: `POST /storage/upload` (multipart: `bucket`, `file`, opcional `path`)
- Perfis, stories, universes, arcs, chapters, blocks, comments, likes, follow — ver `apps/api/README.md`

## Tipos TypeScript

Os tipos de tabelas continuam em `src/integrations/supabase/types.ts` (gerados do schema). O ficheiro `client.ts` está vazio de propósito.

## Dev

```bash
# Terminal 1
cd apps/api && cargo run

# Terminal 2
npm run dev
```

## Remover dependências Supabase do package.json (opcional)

Quando confirmares que não há imports residuais:

```bash
npm uninstall @supabase/supabase-js @supabase/ssr
```
