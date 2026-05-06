CREATE TABLE public.arcs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  universe_id UUID NOT NULL REFERENCES public.universes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('character', 'era', 'planet', 'event', 'custom')),
  cover_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.arcs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Arcs viewable by everyone"
ON public.arcs FOR SELECT USING (true);

CREATE POLICY "Users can create arcs in own universes"
ON public.arcs FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.universes
    WHERE universes.id = arcs.universe_id
      AND universes.owner_id = auth.uid()
  )
);

CREATE POLICY "Users can update arcs in own universes"
ON public.arcs FOR UPDATE USING (
  EXISTS (
    SELECT 1
    FROM public.universes
    WHERE universes.id = arcs.universe_id
      AND universes.owner_id = auth.uid()
  )
);

CREATE POLICY "Users can delete arcs in own universes"
ON public.arcs FOR DELETE USING (
  EXISTS (
    SELECT 1
    FROM public.universes
    WHERE universes.id = arcs.universe_id
      AND universes.owner_id = auth.uid()
  )
);

CREATE INDEX idx_arcs_universe_id ON public.arcs(universe_id, created_at DESC);

ALTER TABLE public.stories
  ADD COLUMN arc_id UUID REFERENCES public.arcs(id) ON DELETE SET NULL;

CREATE INDEX idx_stories_arc_id ON public.stories(arc_id);

CREATE OR REPLACE FUNCTION public.validate_story_arc_universe()
RETURNS TRIGGER AS $$
DECLARE
  arc_universe_id UUID;
BEGIN
  IF NEW.arc_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT universe_id
  INTO arc_universe_id
  FROM public.arcs
  WHERE id = NEW.arc_id;

  IF arc_universe_id IS NULL THEN
    RAISE EXCEPTION 'Arc not found';
  END IF;

  IF NEW.universe_id IS DISTINCT FROM arc_universe_id THEN
    RAISE EXCEPTION 'Story universe_id must match arc universe_id';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_story_arc_universe_trigger
BEFORE INSERT OR UPDATE ON public.stories
FOR EACH ROW
EXECUTE FUNCTION public.validate_story_arc_universe();

INSERT INTO storage.buckets (id, name, public) VALUES ('arc-covers', 'arc-covers', true);

CREATE POLICY "Arc covers are publicly accessible"
ON storage.objects FOR SELECT USING (bucket_id = 'arc-covers');

CREATE POLICY "Users can upload arc covers"
ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'arc-covers'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update arc covers"
ON storage.objects FOR UPDATE USING (
  bucket_id = 'arc-covers'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete arc covers"
ON storage.objects FOR DELETE USING (
  bucket_id = 'arc-covers'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
