-- Transactional outbox for Feed Platform domain events (RFC v3 Phase A).

CREATE TABLE IF NOT EXISTS public.event_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    producer TEXT NOT NULL DEFAULT 'api',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_event_outbox_unpublished
    ON public.event_outbox (created_at ASC)
    WHERE published_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_event_outbox_event_type
    ON public.event_outbox (event_type);
