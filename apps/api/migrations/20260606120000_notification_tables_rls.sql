-- Enable RLS on notification tables exposed to PostgREST.

ALTER TABLE public.notification_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notification_subscriptions'
      AND policyname = 'Users can view own notification subscriptions'
  ) THEN
    CREATE POLICY "Users can view own notification subscriptions"
      ON public.notification_subscriptions FOR SELECT USING (auth.uid() = subscriber_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notification_subscriptions'
      AND policyname = 'Users can create own notification subscriptions'
  ) THEN
    CREATE POLICY "Users can create own notification subscriptions"
      ON public.notification_subscriptions FOR INSERT WITH CHECK (
        auth.uid() = subscriber_id
        AND subscriber_id <> target_user_id
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notification_subscriptions'
      AND policyname = 'Users can update own notification subscriptions'
  ) THEN
    CREATE POLICY "Users can update own notification subscriptions"
      ON public.notification_subscriptions FOR UPDATE USING (auth.uid() = subscriber_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notification_subscriptions'
      AND policyname = 'Users can delete own notification subscriptions'
  ) THEN
    CREATE POLICY "Users can delete own notification subscriptions"
      ON public.notification_subscriptions FOR DELETE USING (auth.uid() = subscriber_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications'
      AND policyname = 'Users can view own notifications'
  ) THEN
    CREATE POLICY "Users can view own notifications"
      ON public.notifications FOR SELECT USING (auth.uid() = recipient_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications'
      AND policyname = 'Users can update own notifications'
  ) THEN
    CREATE POLICY "Users can update own notifications"
      ON public.notifications FOR UPDATE USING (auth.uid() = recipient_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'activity_notifications'
      AND policyname = 'Users can view own activity notifications'
  ) THEN
    CREATE POLICY "Users can view own activity notifications"
      ON public.activity_notifications FOR SELECT USING (auth.uid() = recipient_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'activity_notifications'
      AND policyname = 'Users can update own activity notifications'
  ) THEN
    CREATE POLICY "Users can update own activity notifications"
      ON public.activity_notifications FOR UPDATE USING (auth.uid() = recipient_id);
  END IF;
END $$;
