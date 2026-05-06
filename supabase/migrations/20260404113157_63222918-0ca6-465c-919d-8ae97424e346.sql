-- Add tags array column to stories
ALTER TABLE public.stories ADD COLUMN tags text[] DEFAULT '{}';

-- Index for efficient tag filtering
CREATE INDEX idx_stories_tags ON public.stories USING GIN(tags);