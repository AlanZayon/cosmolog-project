
-- Add type and content columns to stories
ALTER TABLE public.stories 
  ADD COLUMN type text NOT NULL DEFAULT 'short_story',
  ADD COLUMN content text;

-- Create comic_pages table
CREATE TABLE public.comic_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  page_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.comic_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comic pages viewable by everyone" ON public.comic_pages FOR SELECT USING (true);
CREATE POLICY "Authors can insert comic pages" ON public.comic_pages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.stories WHERE id = comic_pages.story_id AND author_id = auth.uid())
);
CREATE POLICY "Authors can update comic pages" ON public.comic_pages FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.stories WHERE id = comic_pages.story_id AND author_id = auth.uid())
);
CREATE POLICY "Authors can delete comic pages" ON public.comic_pages FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.stories WHERE id = comic_pages.story_id AND author_id = auth.uid())
);

CREATE INDEX idx_comic_pages_story ON public.comic_pages(story_id, page_order);

-- Create illustrated_blocks table
CREATE TABLE public.illustrated_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  block_type text NOT NULL DEFAULT 'text',
  content text NOT NULL DEFAULT '',
  block_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.illustrated_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Illustrated blocks viewable by everyone" ON public.illustrated_blocks FOR SELECT USING (true);
CREATE POLICY "Authors can insert illustrated blocks" ON public.illustrated_blocks FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.stories WHERE id = illustrated_blocks.story_id AND author_id = auth.uid())
);
CREATE POLICY "Authors can update illustrated blocks" ON public.illustrated_blocks FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.stories WHERE id = illustrated_blocks.story_id AND author_id = auth.uid())
);
CREATE POLICY "Authors can delete illustrated blocks" ON public.illustrated_blocks FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.stories WHERE id = illustrated_blocks.story_id AND author_id = auth.uid())
);

CREATE INDEX idx_illustrated_blocks_story ON public.illustrated_blocks(story_id, block_order);

-- Create comics storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('comics', 'comics', true);

CREATE POLICY "Comic images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'comics');
CREATE POLICY "Authors can upload comic images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'comics' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Authors can update comic images" ON storage.objects FOR UPDATE USING (bucket_id = 'comics' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Authors can delete comic images" ON storage.objects FOR DELETE USING (bucket_id = 'comics' AND auth.uid()::text = (storage.foldername(name))[1]);
