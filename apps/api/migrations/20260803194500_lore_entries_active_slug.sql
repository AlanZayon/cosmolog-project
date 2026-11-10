-- Soft-deleted lore entries must release their slug so a replacement can be created.

ALTER TABLE public.lore_entries
  DROP CONSTRAINT IF EXISTS lore_entries_universe_slug_unique;

CREATE UNIQUE INDEX IF NOT EXISTS lore_entries_universe_slug_active_unique
  ON public.lore_entries (universe_id, slug)
  WHERE deleted_at IS NULL;
