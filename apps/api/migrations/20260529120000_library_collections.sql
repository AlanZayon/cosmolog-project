-- User library collections (Estante) for manually saved stories.
-- Liked stories remain in the existing `likes` table.

CREATE TABLE IF NOT EXISTS public.library_collections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  visibility TEXT NOT NULL DEFAULT 'private',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.library_collection_items (
  collection_id UUID NOT NULL REFERENCES public.library_collections(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  position INTEGER,
  PRIMARY KEY (collection_id, story_id)
);

CREATE INDEX IF NOT EXISTS idx_library_collections_user_id
  ON public.library_collections(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_library_collection_items_collection_id
  ON public.library_collection_items(collection_id, added_at DESC);

CREATE INDEX IF NOT EXISTS idx_library_collection_items_story_id
  ON public.library_collection_items(story_id);

DROP TRIGGER IF EXISTS update_library_collections_updated_at ON public.library_collections;
CREATE TRIGGER update_library_collections_updated_at
  BEFORE UPDATE ON public.library_collections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.library_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_collection_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'library_collections' AND policyname = 'Users can view own library collections'
  ) THEN
    CREATE POLICY "Users can view own library collections"
      ON public.library_collections FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'library_collections' AND policyname = 'Users can create own library collections'
  ) THEN
    CREATE POLICY "Users can create own library collections"
      ON public.library_collections FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'library_collections' AND policyname = 'Users can update own library collections'
  ) THEN
    CREATE POLICY "Users can update own library collections"
      ON public.library_collections FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'library_collections' AND policyname = 'Users can delete own library collections'
  ) THEN
    CREATE POLICY "Users can delete own library collections"
      ON public.library_collections FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'library_collection_items' AND policyname = 'Users can view own library collection items'
  ) THEN
    CREATE POLICY "Users can view own library collection items"
      ON public.library_collection_items FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.library_collections c
          WHERE c.id = collection_id AND c.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'library_collection_items' AND policyname = 'Users can add to own library collections'
  ) THEN
    CREATE POLICY "Users can add to own library collections"
      ON public.library_collection_items FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.library_collections c
          WHERE c.id = collection_id AND c.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'library_collection_items' AND policyname = 'Users can remove from own library collections'
  ) THEN
    CREATE POLICY "Users can remove from own library collections"
      ON public.library_collection_items FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.library_collections c
          WHERE c.id = collection_id AND c.user_id = auth.uid()
        )
      );
  END IF;
END $$;
