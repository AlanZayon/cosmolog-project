-- Test schema for cosmolog API integration tests.
-- Simplified public schema without auth.users FKs or RLS.

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

CREATE TABLE IF NOT EXISTS public.auth_email_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('confirm_email', 'reset_password')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.oauth_accounts (
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, provider_user_id)
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.universes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  owner_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
  feed_display_mode TEXT NOT NULL DEFAULT 'preview' CHECK (feed_display_mode IN ('preview', 'cover')),
  reading_mode TEXT NOT NULL DEFAULT 'vertical' CHECK (reading_mode IN ('vertical', 'horizontal', 'both')),
  content TEXT,
  type TEXT NOT NULL DEFAULT 'short_story',
  universe_id UUID REFERENCES public.universes(id) ON DELETE CASCADE,
  arc_id UUID REFERENCES public.arcs(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chapters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  chapter_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(story_id, chapter_number)
);

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
  chapter_id UUID REFERENCES public.chapters(id) ON DELETE CASCADE,
  block_type TEXT NOT NULL DEFAULT 'text',
  content TEXT NOT NULL DEFAULT '',
  block_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.likes (
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  likes_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.comment_likes (
  user_id UUID NOT NULL,
  comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, comment_id)
);

CREATE TABLE IF NOT EXISTS public.universe_follows (
  user_id UUID NOT NULL,
  universe_id UUID NOT NULL REFERENCES public.universes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, universe_id)
);

CREATE TABLE IF NOT EXISTS public.library_collections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT 'folder',
  visibility TEXT NOT NULL DEFAULT 'private',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.library_collection_items (
  collection_id UUID NOT NULL REFERENCES public.library_collections(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  position INTEGER,
  PRIMARY KEY (collection_id, story_id)
);

CREATE INDEX IF NOT EXISTS idx_library_collections_user_id ON public.library_collections(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_library_collection_items_collection_id ON public.library_collection_items(collection_id, added_at DESC);
CREATE INDEX IF NOT EXISTS idx_library_collection_items_story_id ON public.library_collection_items(story_id);

CREATE TABLE IF NOT EXISTS public.library_collection_saves (
  user_id UUID NOT NULL,
  collection_id UUID NOT NULL REFERENCES public.library_collections(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, collection_id)
);

CREATE INDEX IF NOT EXISTS idx_library_collection_saves_user_saved_at
  ON public.library_collection_saves(user_id, saved_at DESC);

CREATE TABLE IF NOT EXISTS public.notification_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscriber_id UUID NOT NULL,
  target_user_id UUID NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('profile', 'universe')),
  universe_id UUID REFERENCES public.universes(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT true,
  unconsumed_count INTEGER NOT NULL DEFAULT 0 CHECK (unconsumed_count >= 0),
  disabled_at TIMESTAMPTZ,
  disabled_reason TEXT CHECK (
    disabled_reason IS NULL
    OR disabled_reason IN ('unconsumed_threshold', 'user')
  ),
  last_consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notification_subscriptions_scope_universe CHECK (
    (scope = 'profile' AND universe_id IS NULL)
    OR (scope = 'universe' AND universe_id IS NOT NULL)
  ),
  CONSTRAINT notification_subscriptions_no_self CHECK (
    subscriber_id <> target_user_id
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_sub_profile
  ON public.notification_subscriptions (subscriber_id, target_user_id)
  WHERE scope = 'profile';

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_sub_universe
  ON public.notification_subscriptions (subscriber_id, universe_id)
  WHERE scope = 'universe';

CREATE INDEX IF NOT EXISTS idx_notification_subscriptions_target_active
  ON public.notification_subscriptions (target_user_id, active)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_notification_subscriptions_universe_active
  ON public.notification_subscriptions (universe_id, active)
  WHERE active = true AND universe_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id UUID NOT NULL,
  subscription_id UUID NOT NULL REFERENCES public.notification_subscriptions(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'new_story' CHECK (kind = 'new_story'),
  read_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON public.notifications (recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON public.notifications (recipient_id)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_subscription
  ON public.notifications (subscription_id);

CREATE TABLE IF NOT EXISTS public.activity_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id UUID NOT NULL,
  actor_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (
    kind IN (
      'comment_mention',
      'story_comment',
      'comment_reply',
      'comment_liked',
      'profile_alert_activated',
      'universe_alert_activated',
      'collection_saved'
    )
  ),
  story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  universe_id UUID REFERENCES public.universes(id) ON DELETE CASCADE,
  collection_id UUID REFERENCES public.library_collections(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT activity_notifications_kind_refs CHECK (
    (kind IN ('comment_mention', 'story_comment', 'comment_reply', 'comment_liked') AND story_id IS NOT NULL AND comment_id IS NOT NULL)
    OR (kind = 'profile_alert_activated' AND story_id IS NULL AND comment_id IS NULL AND universe_id IS NULL AND collection_id IS NULL)
    OR (kind = 'universe_alert_activated' AND universe_id IS NOT NULL AND story_id IS NULL AND comment_id IS NULL AND collection_id IS NULL)
    OR (kind = 'collection_saved' AND collection_id IS NOT NULL AND story_id IS NULL AND comment_id IS NULL AND universe_id IS NULL)
  ),
  CONSTRAINT activity_notifications_no_self CHECK (recipient_id <> actor_id)
);

CREATE INDEX IF NOT EXISTS idx_activity_notifications_recipient_created
  ON public.activity_notifications (recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_notifications_recipient_unread
  ON public.activity_notifications (recipient_id)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_stories_author_id ON public.stories(author_id);
CREATE INDEX IF NOT EXISTS idx_stories_universe_id ON public.stories(universe_id);
CREATE INDEX IF NOT EXISTS idx_stories_arc_id ON public.stories(arc_id);
CREATE INDEX IF NOT EXISTS idx_chapters_story_id ON public.chapters(story_id, chapter_number);
CREATE INDEX IF NOT EXISTS idx_comic_pages_story ON public.comic_pages(story_id, page_order);
CREATE INDEX IF NOT EXISTS idx_illustrated_blocks_story ON public.illustrated_blocks(story_id, block_order);
