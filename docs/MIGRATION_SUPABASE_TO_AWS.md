# Migração: Supabase → Postgres próprio + AWS (SES/S3) + Google OAuth direto

A partir desta migração o Cosmolog **não depende mais do Supabase**:

| Antes (Supabase) | Depois |
|---|---|
| `auth.users` + GoTrue (sign-in/up/refresh) | Tabela própria `public.users` + auth no Rust (Argon2 + JWT HS256 próprio) |
| Validação de JWT via JWKS do Supabase | Validação local com `AUTH_JWT_SECRET` |
| Provedor Google do Supabase | OAuth direto com Google (`GOOGLE_CLIENT_ID/SECRET`, PKCE + `state`) |
| Emails do GoTrue | Amazon SES (`/auth/confirm-email`, `/auth/forgot-password`, `/auth/reset-password`) |
| Supabase Storage | Amazon S3 (`S3_BUCKET` + `S3_PUBLIC_BASE_URL`) |
| RPC `get_feed` via PostgREST | Função SQL `get_feed(limit, viewer_id)` chamada por sqlx |
| RLS | Autorização no backend Rust (extractors `AuthUser`/`OptionalAuth` + checks de ownership) |

## 1. Banco de dados

### Opção recomendada: dump + restore

1. Faça dump do projeto Supabase (schemas `public` e `auth`):

   ```bash
   pg_dump "$SUPABASE_DATABASE_URL" \
     --schema=public --schema=auth \
     --no-owner --no-privileges -Fc -f cosmolog.dump
   pg_restore --no-owner --no-privileges -d "$NEW_DATABASE_URL" cosmolog.dump
   ```

2. Aponte `DATABASE_URL` para o novo Postgres e rode as migrations:

   ```bash
   cd apps/api && sqlx migrate run
   ```

A migration `20260612120000_own_auth_users.sql`:

- cria `public.users`, `auth_refresh_tokens`, `auth_email_tokens`, `oauth_accounts`;
- copia `auth.users` → `public.users` **preservando os UUIDs** (nada quebra em `profiles.user_id`, `stories.author_id`, `likes`, `comments`, follows, notificações, library);
- copia identidades Google de `auth.identities` → `oauth_accounts`;
- remove todas as FKs que apontavam para `auth.users`;
- remove o trigger `on_auth_user_created` (o cadastro agora cria o profile no Rust).

Depois de validar, o schema `auth` pode ser removido do novo banco (`DROP SCHEMA auth CASCADE`) — opcional.

> A migration também roda sem erro num banco que continua no Supabase (transição em fases) e num banco sem o schema `auth`.

### Senhas

Os hashes de senha do Supabase **não são migrados** (não são exportáveis pela API e o formato é gerenciado pelo GoTrue). Usuários migrados ficam com `password_hash = NULL`:

- Ao tentar login com senha, recebem o erro `password_reset_required` com instrução para usar **"Esqueceu a senha?"** (email via SES) ou entrar com Google.
- O fluxo de reset define a senha nova (Argon2) e já autentica o usuário.

Comunique os usuários sobre a necessidade de redefinir a senha uma única vez.

## 2. Imagens (Supabase Storage → S3)

1. Copie os objetos (os buckets viram prefixos no bucket S3 único):

   ```bash
   # exemplo com rclone (configure os remotes supabase/s3 antes)
   for b in avatars covers comics universe-covers arc-covers; do
     rclone copy supabase:$b s3:$S3_BUCKET/$b
   done
   ```

2. Reescreva as URLs salvas no banco:

   ```sql
   -- Substitua os valores pelos seus
   \set old 'https://SEU-PROJETO.supabase.co/storage/v1/object/public/'
   \set new 'https://SEU-CDN/'

   UPDATE profiles  SET avatar_url      = replace(avatar_url, :'old', :'new') WHERE avatar_url      LIKE :'old' || '%';
   UPDATE stories   SET cover_image_url = replace(cover_image_url, :'old', :'new') WHERE cover_image_url LIKE :'old' || '%';
   UPDATE universes SET cover_image_url = replace(cover_image_url, :'old', :'new') WHERE cover_image_url LIKE :'old' || '%';
   UPDATE arcs      SET cover_image_url = replace(cover_image_url, :'old', :'new') WHERE cover_image_url LIKE :'old' || '%';
   UPDATE comic_pages SET image_url     = replace(image_url, :'old', :'new') WHERE image_url       LIKE :'old' || '%';
   UPDATE illustrated_blocks SET content = replace(content, :'old', :'new') WHERE block_type = 'image' AND content LIKE :'old' || '%';
   ```

3. Enquanto a cópia não acontece, defina `LEGACY_SUPABASE_URL=https://SEU-PROJETO.supabase.co` na API: URLs antigas continuam aceitas pela validação de imagens. Remova a variável ao concluir a etapa 2.

O bucket S3 deve servir leitura pública via CloudFront ou bucket policy; a API só faz `PutObject` (chave `{categoria}/{user_id}/{arquivo}`).

## 3. Google OAuth

1. Google Cloud Console → Credentials → OAuth Client (Web).
2. Authorized redirect URI: `https://SEU-APP/api/auth/google/callback` (e `http://localhost:3000/api/auth/google/callback` para dev).
3. Defina `GOOGLE_CLIENT_ID` no Next (BFF monta a URL de autorização) e `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` na API Rust (troca do code + validação do ID token).

Contas Google existentes continuam funcionando: o `sub` migrado em `oauth_accounts` (ou, se ausente, o vínculo por email verificado) liga ao mesmo usuário/UUID.

## 4. Amazon SES

- Verifique o domínio/remetente no SES e saia do sandbox.
- Variáveis: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `SES_FROM_EMAIL`, `APP_PUBLIC_URL`.
- Sem `SES_FROM_EMAIL`, a API loga o envio (sem token) em vez de enviar — útil em dev.
- `REQUIRE_EMAIL_CONFIRMATION` (default: `true` em produção) controla se o cadastro exige confirmação por email.

## 5. Variáveis novas/removidas

Removidas: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_AUDIENCE` (e JWKS).

Novas (API): `AUTH_JWT_SECRET` (obrigatória em produção), `APP_PUBLIC_URL`, `REQUIRE_EMAIL_CONFIRMATION`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `SES_FROM_EMAIL`, `S3_BUCKET`, `S3_PUBLIC_BASE_URL`, `LEGACY_SUPABASE_URL` (opcional, transição).

Nova (Next): `GOOGLE_CLIENT_ID`.

Ver `apps/api/.env.example` e `.env.example`.

## 6. Observações

- Tokens de acesso emitidos pelo Supabase deixam de valer no deploy: as sessões ativas expiram e o usuário faz login de novo (o refresh antigo retorna 401 e o BFF limpa os cookies).
- `supabase/migrations/` permanece apenas como histórico.
- Os tipos TypeScript em `src/integrations/supabase/types.ts` continuam sendo usados como tipos de tabela (não há dependência de runtime).
