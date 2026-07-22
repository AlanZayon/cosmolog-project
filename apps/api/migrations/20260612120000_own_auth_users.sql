-- Own auth: users, refresh tokens, email tokens and OAuth identities.
-- Replaces Supabase Auth (`auth.users`). Existing Supabase user UUIDs are
-- preserved so profiles/stories/likes/comments keep working unchanged.
-- Supabase password hashes are not migrated: migrated users keep
-- password_hash NULL and must use "forgot password" (or Google) once.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  password_hash TEXT,
  email_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx
  ON public.users (lower(email))
  WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.auth_refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_user
  ON public.auth_refresh_tokens (user_id);

CREATE TABLE IF NOT EXISTS public.auth_email_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('confirm_email', 'reset_password')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_email_tokens_user
  ON public.auth_email_tokens (user_id, purpose);

CREATE TABLE IF NOT EXISTS public.oauth_accounts (
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user
  ON public.oauth_accounts (user_id);

DO $$
DECLARE
  fk RECORD;
BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    -- Copy Supabase users preserving UUIDs. Passwords are not migratable.
    INSERT INTO public.users (id, email, email_verified_at, created_at)
    SELECT u.id, lower(u.email), u.email_confirmed_at, u.created_at
    FROM auth.users u
    WHERE u.email IS NOT NULL
    ON CONFLICT (id) DO NOTHING;

    -- Re-link Google identities when the Supabase identities table is available.
    BEGIN
      INSERT INTO public.oauth_accounts (provider, provider_user_id, user_id, email)
      SELECT i.provider, i.provider_id, i.user_id, lower(i.email)
      FROM auth.identities i
      JOIN public.users pu ON pu.id = i.user_id
      WHERE i.provider = 'google'
      ON CONFLICT DO NOTHING;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      RAISE NOTICE 'skipping auth.identities import (schema not available)';
    END;

    -- Drop every FK that still points at auth.users; ownership/authorization
    -- is enforced by the Rust API.
    FOR fk IN
      SELECT c.conname, c.conrelid::regclass AS table_name
      FROM pg_constraint c
      WHERE c.contype = 'f' AND c.confrelid = 'auth.users'::regclass
    LOOP
      EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', fk.table_name, fk.conname);
    END LOOP;

    -- The old signup trigger created profiles from auth.users inserts.
    EXECUTE 'DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users';
  END IF;

  -- Safety net: profiles whose user never existed in auth.users still get a
  -- users row (email unknown; account recoverable via support only).
  IF to_regclass('public.profiles') IS NOT NULL THEN
    INSERT INTO public.users (id, created_at)
    SELECT p.user_id, p.created_at
    FROM public.profiles p
    LEFT JOIN public.users u ON u.id = p.user_id
    WHERE u.id IS NULL;
  END IF;
END $$;
