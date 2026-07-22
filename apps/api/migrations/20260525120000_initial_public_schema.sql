-- Bootstrap public schema on fresh Postgres (no Supabase pg_restore).
-- Idempotent: no-op when tables already exist from a Supabase import.
-- Provides a minimal auth stub so later migrations referencing auth.users succeed.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  raw_user_meta_data JSONB NOT NULL DEFAULT '{}',
  email_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$ SELECT NULL::UUID $$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.universes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  owner_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_universes_updated_at ON public.universes;
CREATE TRIGGER update_universes_updated_at
  BEFORE UPDATE ON public.universes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.arcs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  universe_id UUID NOT NULL REFERENCES public.universes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('character', 'era', 'planet', 'event', 'custom')),
  cover_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'short_story';
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS universe_id UUID REFERENCES public.universes(id) ON DELETE CASCADE;
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS arc_id UUID REFERENCES public.arcs(id) ON DELETE SET NULL;
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS feed_display_mode TEXT NOT NULL DEFAULT 'preview';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'stories_feed_display_mode_check'
      AND conrelid = 'public.stories'::regclass
  ) THEN
    ALTER TABLE public.stories
      ADD CONSTRAINT stories_feed_display_mode_check
      CHECK (feed_display_mode IN ('preview', 'cover'));
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_stories_updated_at ON public.stories;
CREATE TRIGGER update_stories_updated_at
  BEFORE UPDATE ON public.stories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.chapters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  chapter_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (story_id, chapter_number)
);

DROP TRIGGER IF EXISTS update_chapters_updated_at ON public.chapters;
CREATE TRIGGER update_chapters_updated_at
  BEFORE UPDATE ON public.chapters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.comic_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  page_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.illustrated_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  block_type TEXT NOT NULL DEFAULT 'text',
  content TEXT NOT NULL DEFAULT '',
  block_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.illustrated_blocks
  ADD COLUMN IF NOT EXISTS chapter_id UUID REFERENCES public.chapters(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.likes (
  user_id UUID NOT NULL,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, story_id)
);

CREATE TABLE IF NOT EXISTS public.comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.universe_follows (
  user_id UUID NOT NULL,
  universe_id UUID NOT NULL REFERENCES public.universes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, universe_id)
);

CREATE OR REPLACE FUNCTION public.validate_story_arc_universe()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  arc_universe_id UUID;
BEGIN
  IF NEW.arc_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT universe_id
  INTO arc_universe_id
  FROM public.arcs
  WHERE id = NEW.arc_id;

  IF arc_universe_id IS NULL THEN
    RAISE EXCEPTION 'Arc not found';
  END IF;

  IF NEW.universe_id IS DISTINCT FROM arc_universe_id THEN
    RAISE EXCEPTION 'Story universe_id must match arc universe_id';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_story_arc_universe_trigger ON public.stories;
CREATE TRIGGER validate_story_arc_universe_trigger
  BEFORE INSERT OR UPDATE ON public.stories
  FOR EACH ROW EXECUTE FUNCTION public.validate_story_arc_universe();

CREATE OR REPLACE FUNCTION public.update_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.stories SET likes_count = likes_count + 1 WHERE id = NEW.story_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.stories SET likes_count = likes_count - 1 WHERE id = OLD.story_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_like_change ON public.likes;
CREATE TRIGGER on_like_change
  AFTER INSERT OR DELETE ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.update_likes_count();

CREATE OR REPLACE FUNCTION public.update_comments_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.stories SET comments_count = comments_count + 1 WHERE id = NEW.story_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.stories SET comments_count = comments_count - 1 WHERE id = OLD.story_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_comment_change ON public.comments;
CREATE TRIGGER on_comment_change
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_comments_count();

CREATE INDEX IF NOT EXISTS idx_stories_author ON public.stories(author_id);
CREATE INDEX IF NOT EXISTS idx_stories_likes ON public.stories(likes_count DESC);
CREATE INDEX IF NOT EXISTS idx_stories_created ON public.stories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_tags ON public.stories USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_stories_universe_id ON public.stories(universe_id);
CREATE INDEX IF NOT EXISTS idx_stories_arc_id ON public.stories(arc_id);
CREATE INDEX IF NOT EXISTS idx_chapters_story ON public.chapters(story_id, chapter_number);
CREATE INDEX IF NOT EXISTS idx_comic_pages_story ON public.comic_pages(story_id, page_order);
CREATE INDEX IF NOT EXISTS idx_illustrated_blocks_story ON public.illustrated_blocks(story_id, block_order);
CREATE INDEX IF NOT EXISTS idx_illustrated_blocks_chapter ON public.illustrated_blocks(chapter_id, block_order)
  WHERE chapter_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_illustrated_blocks_story_level ON public.illustrated_blocks(story_id, block_order)
  WHERE chapter_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_comments_story ON public.comments(story_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_arcs_universe_id ON public.arcs(universe_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_universe_follows_universe ON public.universe_follows(universe_id);
