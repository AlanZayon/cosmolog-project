-- Collection icon for visual identification in the Estante.

ALTER TABLE public.library_collections
  ADD COLUMN IF NOT EXISTS icon TEXT NOT NULL DEFAULT 'folder';
