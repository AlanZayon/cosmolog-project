-- Activity notifications (inbox): separate from story-alert `notifications` (avisos).

CREATE TABLE IF NOT EXISTS public.activity_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (
    kind IN (
      'comment_mention',
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
    (kind = 'comment_mention' AND story_id IS NOT NULL AND comment_id IS NOT NULL)
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
