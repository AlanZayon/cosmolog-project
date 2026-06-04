-- Activity notification: someone liked your comment.

ALTER TABLE public.activity_notifications
  DROP CONSTRAINT IF EXISTS activity_notifications_kind_refs;

ALTER TABLE public.activity_notifications
  DROP CONSTRAINT IF EXISTS activity_notifications_kind_check;

ALTER TABLE public.activity_notifications
  ADD CONSTRAINT activity_notifications_kind_check CHECK (
    kind IN (
      'comment_mention',
      'story_comment',
      'comment_liked',
      'profile_alert_activated',
      'universe_alert_activated',
      'collection_saved'
    )
  );

ALTER TABLE public.activity_notifications
  ADD CONSTRAINT activity_notifications_kind_refs CHECK (
    (kind IN ('comment_mention', 'story_comment', 'comment_liked') AND story_id IS NOT NULL AND comment_id IS NOT NULL)
    OR (kind = 'profile_alert_activated' AND story_id IS NULL AND comment_id IS NULL AND universe_id IS NULL AND collection_id IS NULL)
    OR (kind = 'universe_alert_activated' AND universe_id IS NOT NULL AND story_id IS NULL AND comment_id IS NULL AND collection_id IS NULL)
    OR (kind = 'collection_saved' AND collection_id IS NOT NULL AND story_id IS NULL AND comment_id IS NULL AND universe_id IS NULL)
  );
