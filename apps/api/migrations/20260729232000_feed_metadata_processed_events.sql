-- Feed Platform Phase B: idempotency + metadata.

CREATE TABLE IF NOT EXISTS public.processed_events (
    event_id UUID PRIMARY KEY,
    event_type TEXT NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.feed_metadata (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.feed_metadata (key, value, version)
VALUES (
    'weights.global',
    '{"recency": 1.0, "popularity": 0.6, "following": 2.0, "max_candidates": 500}'::jsonb,
    1
)
ON CONFLICT (key) DO NOTHING;
