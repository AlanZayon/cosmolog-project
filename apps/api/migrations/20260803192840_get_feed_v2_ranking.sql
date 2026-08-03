-- SQL feed MVP ranking: freshness half-life, engagement, follow, own demote,
-- delivery damping, diversity penalties, daily jitter. Same signature as before.
-- Two-phase: cheap score pool → shaping → hydrate payloads for chosen rows only.

DROP FUNCTION IF EXISTS public.get_feed(INTEGER);
DROP FUNCTION IF EXISTS public.get_feed(INTEGER, UUID);

CREATE OR REPLACE FUNCTION public.get_feed(limit_count INTEGER DEFAULT 30, viewer_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  type TEXT,
  payload JSONB,
  ranking_score DOUBLE PRECISION
)
LANGUAGE plpgsql
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  weights JSONB;
  w_fresh DOUBLE PRECISION;
  half_life_hours DOUBLE PRECISION;
  w_follow DOUBLE PRECISION;
  w_engagement DOUBLE PRECISION;
  w_engagement_72h DOUBLE PRECISION;
  w_own DOUBLE PRECISION;
  w_seen DOUBLE PRECISION;
  w_jitter DOUBLE PRECISION;
  author_penalty DOUBLE PRECISION;
  universe_penalty DOUBLE PRECISION;
  tier_arc DOUBLE PRECISION;
  tier_universe DOUBLE PRECISION;
  pool_size INTEGER;
  candidate RECORD;
  emitted_count INTEGER := 0;
  consecutive_non_story INTEGER := 0;
  arc_emitted INTEGER := 0;
  universe_emitted INTEGER := 0;
  max_arcs INTEGER;
  max_universes INTEGER;
  chosen_types TEXT[] := ARRAY[]::TEXT[];
  chosen_ids UUID[] := ARRAY[]::UUID[];
  chosen_scores DOUBLE PRECISION[] := ARRAY[]::DOUBLE PRECISION[];
  day_key TEXT;
BEGIN
  SELECT value INTO weights FROM public.feed_metadata WHERE key = 'weights.sql_feed';
  w_fresh := COALESCE((weights->>'freshness')::DOUBLE PRECISION, 1.0);
  half_life_hours := COALESCE((weights->>'half_life_hours')::DOUBLE PRECISION, 30.0);
  w_follow := COALESCE((weights->>'following')::DOUBLE PRECISION, 1.2);
  w_engagement := COALESCE((weights->>'engagement')::DOUBLE PRECISION, 0.7);
  w_engagement_72h := COALESCE((weights->>'engagement_72h')::DOUBLE PRECISION, 0.5);
  w_own := COALESCE((weights->>'own')::DOUBLE PRECISION, -0.7);
  w_seen := COALESCE((weights->>'seen')::DOUBLE PRECISION, 0.45);
  w_jitter := COALESCE((weights->>'jitter')::DOUBLE PRECISION, 0.06);
  author_penalty := COALESCE((weights->>'author_penalty')::DOUBLE PRECISION, 0.18);
  universe_penalty := COALESCE((weights->>'universe_penalty')::DOUBLE PRECISION, 0.10);
  tier_arc := COALESCE((weights->>'tier_arc')::DOUBLE PRECISION, -0.30);
  tier_universe := COALESCE((weights->>'tier_universe')::DOUBLE PRECISION, -0.45);

  pool_size := GREATEST(limit_count * 8, 120);
  max_arcs := GREATEST(2, limit_count / 6);
  max_universes := GREATEST(1, limit_count / 8);
  day_key := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD');

  FOR candidate IN
    WITH followed_universes AS (
      SELECT uf.universe_id
      FROM public.universe_follows uf
      WHERE uf.user_id = viewer_id
    ),
    owned_universes AS (
      SELECT uo.id AS universe_id
      FROM public.universes uo
      WHERE uo.owner_id = viewer_id
    ),
    recent_likes AS (
      SELECT l.story_id, COUNT(*)::INTEGER AS cnt
      FROM public.likes l
      WHERE l.created_at > now() - INTERVAL '72 hours'
      GROUP BY l.story_id
    ),
    recent_comments AS (
      SELECT c.story_id, COUNT(*)::INTEGER AS cnt
      FROM public.comments c
      WHERE c.created_at > now() - INTERVAL '72 hours'
      GROUP BY c.story_id
    ),
    universe_followers AS (
      SELECT uf.universe_id, COUNT(*)::INTEGER AS follower_count
      FROM public.universe_follows uf
      GROUP BY uf.universe_id
    ),
    story_base AS (
      SELECT
        s.id,
        'story'::TEXT AS type,
        s.author_id,
        s.universe_id,
        (
          w_fresh * power(0.5, GREATEST(EXTRACT(EPOCH FROM (now() - s.created_at)), 0) / 3600.0 / NULLIF(half_life_hours, 0))
          + w_follow * CASE
              WHEN fu.universe_id IS NOT NULL AND ou.universe_id IS NULL THEN 1.0
              ELSE 0.0
            END
          + w_engagement * ln(1.0 + 2.0 * GREATEST(s.likes_count, 0) + 3.0 * GREATEST(s.comments_count, 0)) / ln(41.0)
          + w_engagement_72h * ln(1.0 + 2.0 * COALESCE(rl.cnt, 0) + 3.0 * COALESCE(rc.cnt, 0)) / ln(11.0)
          + w_own * CASE WHEN s.author_id = viewer_id THEN 1.0 ELSE 0.0 END
          - w_seen * LEAST(ln(1.0 + COALESCE(fd.delivery_count, 0)) / ln(6.0), 1.0)
          + w_jitter * (
              (hashtext(COALESCE(viewer_id::TEXT, 'anon') || ':' || s.id::TEXT || ':' || day_key)::BIGINT & 2147483647)::FLOAT8
              / 2147483647.0
            )
        ) AS base_score
      FROM public.stories s
      LEFT JOIN followed_universes fu ON fu.universe_id = s.universe_id
      LEFT JOIN owned_universes ou ON ou.universe_id = s.universe_id
      LEFT JOIN recent_likes rl ON rl.story_id = s.id
      LEFT JOIN recent_comments rc ON rc.story_id = s.id
      LEFT JOIN public.feed_deliveries fd
        ON fd.user_id = viewer_id AND fd.item_type = 'story' AND fd.item_id = s.id
    ),
    arc_base AS (
      SELECT
        a.id,
        'arc'::TEXT AS type,
        u.owner_id AS author_id,
        a.universe_id,
        (
          tier_arc
          + w_fresh * power(
              0.5,
              GREATEST(EXTRACT(EPOCH FROM (now() - MAX(s.created_at))), 0) / 3600.0 / NULLIF(half_life_hours, 0)
            )
          + (0.6 * w_follow) * CASE
              WHEN fu.universe_id IS NOT NULL AND ou.universe_id IS NULL THEN 1.0
              ELSE 0.0
            END
          + LEAST(COUNT(s.id), 5) * 0.04
          - w_seen * LEAST(ln(1.0 + COALESCE(MAX(fd.delivery_count), 0)) / ln(6.0), 1.0)
          + w_jitter * (
              (hashtext(COALESCE(viewer_id::TEXT, 'anon') || ':' || a.id::TEXT || ':' || day_key)::BIGINT & 2147483647)::FLOAT8
              / 2147483647.0
            )
        ) AS base_score
      FROM public.arcs a
      JOIN public.universes u ON u.id = a.universe_id
      JOIN public.stories s ON s.arc_id = a.id
      LEFT JOIN followed_universes fu ON fu.universe_id = a.universe_id
      LEFT JOIN owned_universes ou ON ou.universe_id = a.universe_id
      LEFT JOIN public.feed_deliveries fd
        ON fd.user_id = viewer_id AND fd.item_type = 'arc' AND fd.item_id = a.id
      GROUP BY a.id, u.owner_id, a.universe_id, fu.universe_id, ou.universe_id
      HAVING COUNT(s.id) >= 2
         AND MAX(s.created_at) > now() - INTERVAL '60 days'
    ),
    universe_story_stats AS (
      SELECT
        s.universe_id,
        COUNT(*)::INTEGER AS story_count,
        MAX(s.created_at) AS latest_story_at
      FROM public.stories s
      WHERE s.universe_id IS NOT NULL
      GROUP BY s.universe_id
    ),
    universe_base AS (
      SELECT
        u.id,
        'universe'::TEXT AS type,
        u.owner_id AS author_id,
        u.id AS universe_id,
        (
          tier_universe
          + w_fresh * power(
              0.5,
              GREATEST(EXTRACT(EPOCH FROM (now() - COALESCE(uss.latest_story_at, u.created_at))), 0)
                / 3600.0 / NULLIF(half_life_hours, 0)
            )
          + 0.4 * ln(1.0 + COALESCE(ufc.follower_count, 0)) / ln(21.0)
          - w_seen * LEAST(ln(1.0 + COALESCE(fd.delivery_count, 0)) / ln(6.0), 1.0)
          + w_jitter * (
              (hashtext(COALESCE(viewer_id::TEXT, 'anon') || ':' || u.id::TEXT || ':' || day_key)::BIGINT & 2147483647)::FLOAT8
              / 2147483647.0
            )
        ) AS base_score
      FROM public.universes u
      JOIN universe_story_stats uss ON uss.universe_id = u.id AND uss.story_count >= 1
      LEFT JOIN universe_followers ufc ON ufc.universe_id = u.id
      LEFT JOIN followed_universes fu ON fu.universe_id = u.id
      LEFT JOIN owned_universes ou ON ou.universe_id = u.id
      LEFT JOIN public.feed_deliveries fd
        ON fd.user_id = viewer_id AND fd.item_type = 'universe' AND fd.item_id = u.id
      WHERE fu.universe_id IS NULL
        AND ou.universe_id IS NULL
    ),
    candidate_pool AS (
      SELECT * FROM story_base
      UNION ALL
      SELECT * FROM arc_base
      UNION ALL
      SELECT * FROM universe_base
    ),
    scored AS (
      SELECT
        cp.id,
        cp.type,
        cp.author_id,
        cp.universe_id,
        cp.base_score
          - author_penalty * LEAST(
              (ROW_NUMBER() OVER (
                PARTITION BY cp.author_id
                ORDER BY cp.base_score DESC
              ) - 1)::DOUBLE PRECISION,
              3.0
            )
          - universe_penalty * LEAST(
              (ROW_NUMBER() OVER (
                PARTITION BY COALESCE(cp.universe_id, cp.id)
                ORDER BY cp.base_score DESC
              ) - 1)::DOUBLE PRECISION,
              3.0
            ) AS ranking_score
      FROM candidate_pool cp
    )
    SELECT scored.id, scored.type, scored.ranking_score
    FROM scored
    ORDER BY scored.ranking_score DESC
    LIMIT pool_size
  LOOP
    EXIT WHEN emitted_count >= limit_count;

    IF candidate.type <> 'story' THEN
      -- No discovery cards before the 3rd slot (1-indexed positions 1 and 2).
      IF emitted_count < 2 THEN
        CONTINUE;
      END IF;
      IF consecutive_non_story >= 2 THEN
        CONTINUE;
      END IF;
      IF candidate.type = 'arc' AND arc_emitted >= max_arcs THEN
        CONTINUE;
      END IF;
      IF candidate.type = 'universe' AND universe_emitted >= max_universes THEN
        CONTINUE;
      END IF;
    END IF;

    chosen_types := array_append(chosen_types, candidate.type);
    chosen_ids := array_append(chosen_ids, candidate.id);
    chosen_scores := array_append(chosen_scores, candidate.ranking_score);

    IF candidate.type = 'story' THEN
      consecutive_non_story := 0;
    ELSE
      consecutive_non_story := consecutive_non_story + 1;
      IF candidate.type = 'arc' THEN
        arc_emitted := arc_emitted + 1;
      ELSIF candidate.type = 'universe' THEN
        universe_emitted := universe_emitted + 1;
      END IF;
    END IF;

    emitted_count := emitted_count + 1;
  END LOOP;

  IF emitted_count = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH chosen AS (
    SELECT *
    FROM unnest(chosen_types, chosen_ids, chosen_scores)
      WITH ORDINALITY AS t(item_type, item_id, item_score, ord)
  ),
  story_payloads AS (
    SELECT
      s.id AS item_id,
      jsonb_build_object(
        'id', s.id,
        'title', s.title,
        'description', s.description,
        'storyType', s.type,
        'coverImageUrl', s.cover_image_url,
        'feedDisplayMode', s.feed_display_mode,
        'readingMode', s.reading_mode,
        'previewImageUrls', CASE
          WHEN s.type = 'comic' THEN COALESCE((
            SELECT jsonb_agg(cp.image_url ORDER BY cp.page_order ASC)
            FROM (
              SELECT image_url, page_order
              FROM public.comic_pages
              WHERE story_id = s.id
              ORDER BY page_order ASC
              LIMIT 3
            ) cp
          ), '[]'::jsonb)
          ELSE '[]'::jsonb
        END,
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
      ) AS payload
    FROM public.stories s
    JOIN public.profiles p ON p.user_id = s.author_id
    LEFT JOIN public.universes u ON u.id = s.universe_id
    LEFT JOIN public.arcs a ON a.id = s.arc_id
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
    WHERE s.id IN (SELECT c.item_id FROM chosen c WHERE c.item_type = 'story')
  ),
  arc_payloads AS (
    SELECT
      a.id AS item_id,
      jsonb_build_object(
        'id', a.id,
        'name', a.name,
        'description', a.description,
        'arcType', a.type,
        'coverImageUrl', a.cover_image_url,
        'storyCount', (
          SELECT COUNT(*)::INTEGER FROM public.stories s WHERE s.arc_id = a.id
        ),
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
      ) AS payload
    FROM public.arcs a
    JOIN public.universes u ON u.id = a.universe_id
    WHERE a.id IN (SELECT c.item_id FROM chosen c WHERE c.item_type = 'arc')
  ),
  universe_payloads AS (
    SELECT
      u.id AS item_id,
      jsonb_build_object(
        'id', u.id,
        'title', u.title,
        'tagline', COALESCE(u.description, ''),
        'coverImageUrl', u.cover_image_url,
        'storyCount', COALESCE((
          SELECT COUNT(*)::INTEGER FROM public.stories s WHERE s.universe_id = u.id
        ), 0),
        'arcCount', COALESCE((
          SELECT COUNT(*)::INTEGER FROM public.arcs a WHERE a.universe_id = u.id
        ), 0)
      ) AS payload
    FROM public.universes u
    WHERE u.id IN (SELECT c.item_id FROM chosen c WHERE c.item_type = 'universe')
  )
  SELECT
    c.item_id,
    c.item_type,
    COALESCE(sp.payload, ap.payload, up.payload),
    c.item_score
  FROM chosen c
  LEFT JOIN story_payloads sp ON c.item_type = 'story' AND sp.item_id = c.item_id
  LEFT JOIN arc_payloads ap ON c.item_type = 'arc' AND ap.item_id = c.item_id
  LEFT JOIN universe_payloads up ON c.item_type = 'universe' AND up.item_id = c.item_id
  WHERE COALESCE(sp.payload, ap.payload, up.payload) IS NOT NULL
  ORDER BY c.ord ASC;
END;
$$;
