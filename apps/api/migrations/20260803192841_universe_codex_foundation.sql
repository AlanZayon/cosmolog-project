-- Universe Codex (Perfect Works–style encyclopedia) foundation.

ALTER TABLE public.universes
  ADD COLUMN IF NOT EXISTS codex_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS saga_premise TEXT,
  ADD COLUMN IF NOT EXISTS default_calendar_label TEXT,
  ADD COLUMN IF NOT EXISTS afterword TEXT;

CREATE TABLE IF NOT EXISTS public.lore_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id UUID NOT NULL REFERENCES public.universes(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  cover_image_url TEXT,
  canon_status TEXT NOT NULL DEFAULT 'canon',
  publish_state TEXT NOT NULL DEFAULT 'published',
  parent_entry_id UUID REFERENCES public.lore_entries(id) ON DELETE SET NULL,
  sort_key INTEGER NOT NULL DEFAULT 0,
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lore_entries_kind_check CHECK (kind IN (
    'episode', 'era', 'event', 'faction', 'institution', 'social_class',
    'place', 'creature', 'system', 'glossary_term', 'vehicle', 'character',
    'drama_synopsis', 'side_tale', 'meta_essay', 'custom'
  )),
  CONSTRAINT lore_entries_canon_status_check CHECK (canon_status IN ('canon', 'apocrypha', 'meta')),
  CONSTRAINT lore_entries_publish_state_check CHECK (publish_state IN ('draft', 'published')),
  CONSTRAINT lore_entries_universe_slug_unique UNIQUE (universe_id, slug)
);

DROP TRIGGER IF EXISTS update_lore_entries_updated_at ON public.lore_entries;
CREATE TRIGGER update_lore_entries_updated_at
  BEFORE UPDATE ON public.lore_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_lore_entries_universe_kind
  ON public.lore_entries (universe_id, kind)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lore_entries_universe_title
  ON public.lore_entries (universe_id, title);
CREATE INDEX IF NOT EXISTS idx_lore_entries_parent
  ON public.lore_entries (parent_entry_id)
  WHERE parent_entry_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.lore_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.lore_entries(id) ON DELETE CASCADE,
  block_type TEXT NOT NULL DEFAULT 'text',
  content TEXT NOT NULL DEFAULT '',
  block_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lore_blocks_type_check CHECK (block_type IN ('text', 'image'))
);

CREATE INDEX IF NOT EXISTS idx_lore_blocks_entry
  ON public.lore_blocks (entry_id, block_order);

CREATE TABLE IF NOT EXISTS public.lore_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id UUID NOT NULL REFERENCES public.universes(id) ON DELETE CASCADE,
  from_entry_id UUID NOT NULL REFERENCES public.lore_entries(id) ON DELETE CASCADE,
  to_entry_id UUID NOT NULL REFERENCES public.lore_entries(id) ON DELETE CASCADE,
  rel_type TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lore_relations_rel_type_check CHECK (rel_type IN (
    'related', 'causes', 'caused_by', 'member_of', 'rules', 'subordinate_to',
    'allied_with', 'at_war_with', 'located_in', 'habitat', 'defines',
    'depends_on', 'part_of', 'piloted_by', 'variant_of', 'knows', 'family',
    'rival', 'serves', 'reincarnation_of', 'appears_with', 'custom'
  )),
  CONSTRAINT lore_relations_no_self CHECK (from_entry_id <> to_entry_id),
  CONSTRAINT lore_relations_unique UNIQUE (from_entry_id, to_entry_id, rel_type)
);

CREATE INDEX IF NOT EXISTS idx_lore_relations_from ON public.lore_relations (from_entry_id);
CREATE INDEX IF NOT EXISTS idx_lore_relations_to ON public.lore_relations (to_entry_id);
CREATE INDEX IF NOT EXISTS idx_lore_relations_universe ON public.lore_relations (universe_id);

CREATE TABLE IF NOT EXISTS public.timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id UUID NOT NULL REFERENCES public.universes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT,
  body TEXT NOT NULL DEFAULT '',
  occurred_at_label TEXT,
  sort_key BIGINT NOT NULL DEFAULT 0,
  era_entry_id UUID REFERENCES public.lore_entries(id) ON DELETE SET NULL,
  confidence TEXT NOT NULL DEFAULT 'confirmed',
  cover_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT timeline_events_confidence_check CHECK (confidence IN ('confirmed', 'uncertain', 'legendary'))
);

DROP TRIGGER IF EXISTS update_timeline_events_updated_at ON public.timeline_events;
CREATE TRIGGER update_timeline_events_updated_at
  BEFORE UPDATE ON public.timeline_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_timeline_events_universe_sort
  ON public.timeline_events (universe_id, sort_key, created_at);

CREATE TABLE IF NOT EXISTS public.lore_appearances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.lore_entries(id) ON DELETE CASCADE,
  story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES public.chapters(id) ON DELETE CASCADE,
  timeline_event_id UUID REFERENCES public.timeline_events(id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lore_appearances_one_target CHECK (
    (CASE WHEN story_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN chapter_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN timeline_event_id IS NOT NULL THEN 1 ELSE 0 END) = 1
  )
);

CREATE INDEX IF NOT EXISTS idx_lore_appearances_entry ON public.lore_appearances (entry_id);
CREATE INDEX IF NOT EXISTS idx_lore_appearances_story ON public.lore_appearances (story_id)
  WHERE story_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.arc_lore_links (
  arc_id UUID NOT NULL REFERENCES public.arcs(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL REFERENCES public.lore_entries(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (arc_id, entry_id)
);

CREATE TABLE IF NOT EXISTS public.maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id UUID NOT NULL REFERENCES public.universes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  sort_key INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_maps_updated_at ON public.maps;
CREATE TRIGGER update_maps_updated_at
  BEFORE UPDATE ON public.maps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_maps_universe ON public.maps (universe_id, sort_key);

CREATE TABLE IF NOT EXISTS public.map_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  x_norm DOUBLE PRECISION NOT NULL,
  y_norm DOUBLE PRECISION NOT NULL,
  entry_id UUID REFERENCES public.lore_entries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT map_pins_x_check CHECK (x_norm >= 0 AND x_norm <= 1),
  CONSTRAINT map_pins_y_check CHECK (y_norm >= 0 AND y_norm <= 1)
);

CREATE INDEX IF NOT EXISTS idx_map_pins_map ON public.map_pins (map_id);

CREATE TABLE IF NOT EXISTS public.gallery_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id UUID NOT NULL REFERENCES public.universes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sort_key INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_gallery_collections_updated_at ON public.gallery_collections;
CREATE TRIGGER update_gallery_collections_updated_at
  BEFORE UPDATE ON public.gallery_collections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_gallery_collections_universe
  ON public.gallery_collections (universe_id, sort_key);

CREATE TABLE IF NOT EXISTS public.gallery_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES public.gallery_collections(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  art_kind TEXT NOT NULL DEFAULT 'final',
  entry_id UUID REFERENCES public.lore_entries(id) ON DELETE SET NULL,
  sort_key INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT gallery_assets_art_kind_check CHECK (art_kind IN ('final', 'sketch', 'map', 'diagram'))
);

CREATE INDEX IF NOT EXISTS idx_gallery_assets_collection
  ON public.gallery_assets (collection_id, sort_key);

CREATE TABLE IF NOT EXISTS public.codex_toc_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id UUID NOT NULL REFERENCES public.universes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  section_key TEXT,
  entry_id UUID REFERENCES public.lore_entries(id) ON DELETE SET NULL,
  href_kind TEXT,
  sort_key INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT codex_toc_items_href_kind_check CHECK (
    href_kind IS NULL OR href_kind IN (
      'cover', 'timeline', 'gallery', 'index', 'maps', 'entry', 'kind'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_codex_toc_universe
  ON public.codex_toc_items (universe_id, sort_key);
