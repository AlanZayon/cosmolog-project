CREATE TABLE public.universe_follows (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  universe_id UUID NOT NULL REFERENCES public.universes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, universe_id)
);

ALTER TABLE public.universe_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own universe follows"
ON public.universe_follows FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can follow universes"
ON public.universe_follows FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unfollow universes"
ON public.universe_follows FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_universe_follows_universe ON public.universe_follows(universe_id);

CREATE OR REPLACE FUNCTION public.get_feed(limit_count INTEGER DEFAULT 30)
RETURNS TABLE (
  id UUID,
  type TEXT,
  payload JSONB,
  ranking_score DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  candidate RECORD;
  emitted_count INTEGER := 0;
  consecutive_non_story INTEGER := 0;
BEGIN
  FOR candidate IN
    WITH followed_universes AS (
      SELECT uf.universe_id
      FROM public.universe_follows uf
      WHERE uf.user_id = auth.uid()
      UNION
      SELECT uo.id AS universe_id
      FROM public.universes uo
      WHERE uo.owner_id = auth.uid()
    ),
    story_candidates AS (
      SELECT
        s.id,
        'story'::TEXT AS type,
        jsonb_build_object(
          'id', s.id,
          'title', s.title,
          'description', s.description,
          'storyType', s.type,
          'coverImageUrl', s.cover_image_url,
          'author', jsonb_build_object(
            'id', p.user_id,
            'username', p.username,
            'avatarUrl', p.avatar_url
          ),
          'universe', CASE
            WHEN u.id IS NULL THEN NULL
            ELSE jsonb_build_object(
              'id', u.id,
              'title', u.title,
              'coverImageUrl', u.cover_image_url
            )
          END,
          'arc', CASE
            WHEN a.id IS NULL THEN NULL
            ELSE jsonb_build_object(
              'id', a.id,
              'name', a.name,
              'type', a.type
            )
          END,
          'preview', jsonb_build_object(
            'kind', CASE
              WHEN s.type = 'comic' THEN 'image'
              WHEN s.type = 'illustrated' AND ib_first.block_type = 'image' THEN 'image'
              ELSE 'text'
            END,
            'text', CASE
              WHEN s.type = 'short_story' THEN LEFT(COALESCE(s.content, ''), 320)
              WHEN s.type = 'chapters' THEN LEFT(COALESCE(ch_first.content, s.description, ''), 320)
              WHEN s.type = 'illustrated' AND ib_first.block_type = 'text' THEN LEFT(COALESCE(ib_first.content, ''), 320)
              ELSE LEFT(COALESCE(s.description, ''), 320)
            END,
            'imageUrl', CASE
              WHEN s.type = 'comic' THEN cp_first.image_url
              WHEN s.type = 'illustrated' AND ib_first.block_type = 'image' THEN ib_first.content
              ELSE s.cover_image_url
            END
          ),
          'stats', jsonb_build_object(
            'likes', s.likes_count,
            'comments', s.comments_count
          ),
          'createdAt', s.created_at
        ) AS payload,
        EXTRACT(EPOCH FROM s.created_at)
          + CASE WHEN fu.universe_id IS NOT NULL THEN 100000000 ELSE 0 END
          + CASE WHEN s.arc_id IS NOT NULL THEN 5000 ELSE 0 END
          AS ranking_score
      FROM public.stories s
      JOIN public.profiles p ON p.user_id = s.author_id
      LEFT JOIN public.universes u ON u.id = s.universe_id
      LEFT JOIN public.arcs a ON a.id = s.arc_id
      LEFT JOIN followed_universes fu ON fu.universe_id = s.universe_id
      LEFT JOIN LATERAL (
        SELECT c.content
        FROM public.chapters c
        WHERE c.story_id = s.id
        ORDER BY c.chapter_number ASC
        LIMIT 1
      ) ch_first ON TRUE
      LEFT JOIN LATERAL (
        SELECT cp.image_url
        FROM public.comic_pages cp
        WHERE cp.story_id = s.id
        ORDER BY cp.page_order ASC
        LIMIT 1
      ) cp_first ON TRUE
      LEFT JOIN LATERAL (
        SELECT ib.block_type, ib.content
        FROM public.illustrated_blocks ib
        WHERE ib.story_id = s.id
        ORDER BY ib.block_order ASC
        LIMIT 1
      ) ib_first ON TRUE
    ),
    arc_candidates AS (
      SELECT
        a.id,
        'arc'::TEXT AS type,
        jsonb_build_object(
          'id', a.id,
          'name', a.name,
          'description', a.description,
          'arcType', a.type,
          'coverImageUrl', a.cover_image_url,
          'storyCount', COUNT(s.id),
          'universe', jsonb_build_object(
            'id', u.id,
            'title', u.title,
            'coverImageUrl', u.cover_image_url
          ),
          'stories', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', s2.id,
                'title', s2.title,
                'storyType', s2.type,
                'coverImageUrl', s2.cover_image_url,
                'author', jsonb_build_object(
                  'username', p2.username,
                  'avatarUrl', p2.avatar_url
                )
              )
              ORDER BY s2.created_at DESC
            )
            FROM (
              SELECT *
              FROM public.stories
              WHERE arc_id = a.id
              ORDER BY created_at DESC
              LIMIT 4
            ) s2
            JOIN public.profiles p2 ON p2.user_id = s2.author_id
          ), '[]'::jsonb)
        ) AS payload,
        COALESCE(MAX(EXTRACT(EPOCH FROM s.created_at)), EXTRACT(EPOCH FROM a.created_at))
          + CASE WHEN fu.universe_id IS NOT NULL THEN 50000000 ELSE 0 END
          + CASE WHEN COUNT(s.id) > 1 THEN COUNT(s.id) * 2000 ELSE 500 END
          - 10000000
          AS ranking_score
      FROM public.arcs a
      JOIN public.universes u ON u.id = a.universe_id
      JOIN public.stories s ON s.arc_id = a.id
      LEFT JOIN followed_universes fu ON fu.universe_id = a.universe_id
      GROUP BY a.id, u.id, fu.universe_id
      HAVING COUNT(s.id) >= 1
    ),
    universe_candidates AS (
      SELECT
        u.id,
        'universe'::TEXT AS type,
        jsonb_build_object(
          'id', u.id,
          'title', u.title,
          'tagline', COALESCE(u.description, ''),
          'coverImageUrl', u.cover_image_url,
          'storyCount', COUNT(s.id)
        ) AS payload,
        COALESCE(MAX(EXTRACT(EPOCH FROM s.created_at)), EXTRACT(EPOCH FROM u.created_at))
          + CASE WHEN fu.universe_id IS NOT NULL THEN 25000000 ELSE 0 END
          - 20000000
          AS ranking_score
      FROM public.universes u
      LEFT JOIN public.stories s ON s.universe_id = u.id
      LEFT JOIN followed_universes fu ON fu.universe_id = u.id
      GROUP BY u.id, fu.universe_id
    ),
    ranked_items AS (
      SELECT * FROM story_candidates
      UNION ALL
      SELECT * FROM arc_candidates
      UNION ALL
      SELECT * FROM universe_candidates
    )
    SELECT ranked_items.id, ranked_items.type, ranked_items.payload, ranked_items.ranking_score
    FROM ranked_items
    ORDER BY ranked_items.ranking_score DESC
  LOOP
    EXIT WHEN emitted_count >= limit_count;

    IF candidate.type <> 'story' AND consecutive_non_story >= 2 THEN
      CONTINUE;
    END IF;

    id := candidate.id;
    type := candidate.type;
    payload := candidate.payload;
    ranking_score := candidate.ranking_score;

    IF candidate.type = 'story' THEN
      consecutive_non_story := 0;
    ELSE
      consecutive_non_story := consecutive_non_story + 1;
    END IF;

    emitted_count := emitted_count + 1;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_feed(INTEGER) TO anon, authenticated;
