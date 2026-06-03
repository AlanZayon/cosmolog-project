-- Notification subscriptions (distinct from universe_follows used for feed).

CREATE TABLE IF NOT EXISTS public.notification_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscriber_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

DROP TRIGGER IF EXISTS update_notification_subscriptions_updated_at ON public.notification_subscriptions;
CREATE TRIGGER update_notification_subscriptions_updated_at
  BEFORE UPDATE ON public.notification_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
