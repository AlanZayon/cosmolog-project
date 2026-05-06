
-- Create universes table
CREATE TABLE public.universes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  owner_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.universes ENABLE ROW LEVEL SECURITY;

-- RLS policies for universes
CREATE POLICY "Universes viewable by everyone"
ON public.universes FOR SELECT USING (true);

CREATE POLICY "Users can create own universes"
ON public.universes FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own universes"
ON public.universes FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own universes"
ON public.universes FOR DELETE USING (auth.uid() = owner_id);

-- Trigger for updated_at
CREATE TRIGGER update_universes_updated_at
BEFORE UPDATE ON public.universes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add universe_id to stories (nullable for now to not break existing data)
ALTER TABLE public.stories ADD COLUMN universe_id UUID REFERENCES public.universes(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX idx_stories_universe_id ON public.stories(universe_id);

-- Storage bucket for universe covers
INSERT INTO storage.buckets (id, name, public) VALUES ('universe-covers', 'universe-covers', true);

CREATE POLICY "Universe covers are publicly accessible"
ON storage.objects FOR SELECT USING (bucket_id = 'universe-covers');

CREATE POLICY "Users can upload universe covers"
ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'universe-covers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update universe covers"
ON storage.objects FOR UPDATE USING (bucket_id = 'universe-covers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete universe covers"
ON storage.objects FOR DELETE USING (bucket_id = 'universe-covers' AND auth.uid()::text = (storage.foldername(name))[1]);
