-- SQL feed MVP: delivery memory + indexes for windowed engagement scoring.

CREATE TABLE IF NOT EXISTS public.feed_deliveries (
  user_id UUID NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('story', 'arc', 'universe')),
  item_id UUID NOT NULL,
  delivery_count INTEGER NOT NULL DEFAULT 1,
  first_delivered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_delivered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_feed_deliveries_recent
  ON public.feed_deliveries (user_id, last_delivered_at DESC);

CREATE INDEX IF NOT EXISTS idx_likes_story_created
  ON public.likes (story_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_likes_created
  ON public.likes (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_universes_owner
  ON public.universes (owner_id);

INSERT INTO public.feed_metadata (key, value, version)
VALUES (
  'weights.sql_feed',
  '{
    "freshness": 1.0,
    "half_life_hours": 30.0,
    "following": 1.2,
    "engagement": 0.7,
    "engagement_72h": 0.5,
    "own": -0.7,
    "seen": 0.45,
    "jitter": 0.06,
    "author_penalty": 0.18,
    "universe_penalty": 0.10,
    "tier_arc": -0.30,
    "tier_universe": -0.45
  }'::jsonb,
  1
)
ON CONFLICT (key) DO NOTHING;
