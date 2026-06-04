-- Public library collections: saves (bookmarks) and read policies for public visibility.

CREATE TABLE IF NOT EXISTS public.library_collection_saves (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES public.library_collections(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, collection_id)
);

CREATE INDEX IF NOT EXISTS idx_library_collection_saves_user_saved_at
  ON public.library_collection_saves(user_id, saved_at DESC);

ALTER TABLE public.library_collection_saves ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'library_collection_saves'
      AND policyname = 'Users can view own collection saves'
  ) THEN
    CREATE POLICY "Users can view own collection saves"
      ON public.library_collection_saves FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'library_collection_saves'
      AND policyname = 'Users can save public collections'
  ) THEN
    CREATE POLICY "Users can save public collections"
      ON public.library_collection_saves FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
          SELECT 1 FROM public.library_collections c
          WHERE c.id = collection_id
            AND c.visibility = 'public'
            AND c.user_id <> auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'library_collection_saves'
      AND policyname = 'Users can unsave collections'
  ) THEN
    CREATE POLICY "Users can unsave collections"
      ON public.library_collection_saves FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Allow anyone authenticated to read public collections (owner always via existing policy).
DROP POLICY IF EXISTS "Users can view own library collections" ON public.library_collections;
CREATE POLICY "Users can view own library collections"
  ON public.library_collections FOR SELECT USING (
    auth.uid() = user_id OR visibility = 'public'
  );

DROP POLICY IF EXISTS "Users can view own library collection items" ON public.library_collection_items;
CREATE POLICY "Users can view own library collection items"
  ON public.library_collection_items FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.library_collections c
      WHERE c.id = collection_id
        AND (c.user_id = auth.uid() OR c.visibility = 'public')
    )
  );
