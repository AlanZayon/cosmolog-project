ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS feed_display_mode TEXT NOT NULL DEFAULT 'preview'
  CHECK (feed_display_mode IN ('preview', 'cover'));

-- Include feedDisplayMode in feed story payloads
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
          'feedDisplayMode', s.feed_display_mode,
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
              WHEN s.type = 'short_story' AND ib_story_first.block_type = 'image' THEN 'image'
              WHEN s.type = 'chapters' AND ib_ch_first.block_type = 'image' THEN 'image'
              ELSE 'text'
            END,
            'text', CASE
              WHEN s.type = 'short_story' THEN LEFT(COALESCE(
                CASE WHEN ib_story_first.block_type = 'text' THEN ib_story_first.content ELSE NULL END,
                s.content,
                ''
              ), 320)
              WHEN s.type = 'chapters' THEN LEFT(COALESCE(
                CASE WHEN ib_ch_first.block_type = 'text' THEN ib_ch_first.content ELSE NULL END,
                ch_first.content,
                s.description,
                ''
              ), 320)
              ELSE LEFT(COALESCE(s.description, ''), 320)
            END,
            'imageUrl', CASE
              WHEN s.type = 'comic' THEN cp_first.image_url
              WHEN s.type = 'short_story' AND ib_story_first.block_type = 'image' THEN ib_story_first.content
              WHEN s.type = 'chapters' AND ib_ch_first.block_type = 'image' THEN ib_ch_first.content
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
        WHERE ib.story_id = s.id AND ib.chapter_id IS NULL
        ORDER BY ib.block_order ASC
        LIMIT 1
      ) ib_story_first ON TRUE
      LEFT JOIN LATERAL (
        SELECT ib.block_type, ib.content
        FROM public.illustrated_blocks ib
        JOIN public.chapters c ON c.id = ib.chapter_id
        WHERE c.story_id = s.id
        ORDER BY c.chapter_number ASC, ib.block_order ASC
        LIMIT 1
      ) ib_ch_first ON TRUE
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
    universe_story_counts AS (
      SELECT s.universe_id, COUNT(*)::INTEGER AS story_count, MAX(s.created_at) AS latest_story_at
      FROM public.stories s
      WHERE s.universe_id IS NOT NULL
      GROUP BY s.universe_id
    ),
    universe_arc_counts AS (
      SELECT a.universe_id, COUNT(*)::INTEGER AS arc_count
      FROM public.arcs a
      GROUP BY a.universe_id
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
          'storyCount', COALESCE(usc.story_count, 0),
          'arcCount', COALESCE(uac.arc_count, 0)
        ) AS payload,
        COALESCE(EXTRACT(EPOCH FROM usc.latest_story_at), EXTRACT(EPOCH FROM u.created_at))
          + CASE WHEN fu.universe_id IS NOT NULL THEN 25000000 ELSE 0 END
          - 20000000
          AS ranking_score
      FROM public.universes u
      LEFT JOIN universe_story_counts usc ON usc.universe_id = u.id
      LEFT JOIN universe_arc_counts uac ON uac.universe_id = u.id
      LEFT JOIN followed_universes fu ON fu.universe_id = u.id
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
