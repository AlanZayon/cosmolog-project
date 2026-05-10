import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/hooks/useLanguage';
import StoryCard from '@/components/StoryCard';
import { Globe2, Library } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';
import { HorizontalScrollStrip } from '@/components/browse/HorizontalScrollStrip';
import { browseStoryTileClassNarrow } from '@/components/browse/BrowseContentRow';
import { UniverseArcShelfTile } from '@/components/universe/UniverseArcShelfTile';

type StoryWithProfile = Tables<'stories'> & { profiles: { username: string; avatar_url: string | null } | null };
type Arc = Tables<'arcs'>;

interface Universe {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
}

function fillN(template: string, stories: number, arcs: number) {
  return template.replace(/\{\{stories\}\}/g, String(stories)).replace(/\{\{arcs\}\}/g, String(arcs));
}

export interface UniverseFeedReaderProps {
  universeId: string;
  enabled?: boolean;
  peekLayer?: boolean;
  onOpenArc: (arcId: string) => void;
  onOpenStory: (storyId: string) => void;
  onOpenFullUniverse: () => void;
}

export default function UniverseFeedReader({
  universeId,
  enabled = true,
  peekLayer = false,
  onOpenArc,
  onOpenStory,
  onOpenFullUniverse,
}: UniverseFeedReaderProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [universe, setUniverse] = useState<Universe | null>(null);
  const [stories, setStories] = useState<StoryWithProfile[]>([]);
  const [arcs, setArcs] = useState<Arc[]>([]);

  useEffect(() => {
    if (!enabled || !universeId) return;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      const { data: universeData } = await (supabase.from('universes') as any).select('*').eq('id', universeId).single();
      if (cancelled) return;

      if (!universeData) {
        setUniverse(null);
        setLoading(false);
        return;
      }
      setUniverse(universeData);

      const [{ data: arcData }, { data: storiesData }] = await Promise.all([
        supabase.from('arcs').select('*').eq('universe_id', universeId).order('created_at', { ascending: true }),
        supabase.from('stories').select('*').eq('universe_id', universeId).order('created_at', { ascending: true }),
      ]);

      if (cancelled) return;

      setArcs(arcData || []);

      const storyList = (storiesData || []) as Tables<'stories'>[];
      const authorIds = [...new Set(storyList.map((s) => s.author_id))];
      let profileMap = new Map<string, { username: string; avatar_url: string | null }>();
      if (authorIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, username, avatar_url').in('user_id', authorIds);
        profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);
      }

      setStories(storyList.map((s) => ({ ...s, profiles: profileMap.get(s.author_id) || null })));
      setLoading(false);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [universeId, enabled]);

  const arcStoryMap = useMemo(() => {
    const groups = new Map<string, StoryWithProfile[]>();
    for (const story of stories) {
      if (!story.arc_id) continue;
      if (!groups.has(story.arc_id)) groups.set(story.arc_id, []);
      groups.get(story.arc_id)!.push(story);
    }
    const t = (a: StoryWithProfile, b: StoryWithProfile) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    for (const list of groups.values()) list.sort(t);
    return groups;
  }, [stories]);

  const unassignedStories = useMemo(
    () =>
      stories
        .filter((s) => !s.arc_id)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [stories],
  );

  if (loading) {
    return (
      <div className="min-h-[40vh] p-8 text-center text-muted-foreground">{t('common.loading')}</div>
    );
  }

  if (!universe) {
    return (
      <div className="min-h-[40vh] p-8 text-center text-muted-foreground">{t('universe.notFound')}</div>
    );
  }

  const footer = fillN(t('feed.universeFooterCounts'), stories.length, arcs.length);

  return (
    <div className={peekLayer ? 'relative' : 'min-h-full bg-background'}>
      <div className={peekLayer ? 'mx-auto max-w-none px-0 py-0' : 'mx-auto w-full min-w-0 max-w-6xl px-4 py-6 sm:px-8'}>
        {universe.cover_image_url && (
          <div className="mb-4 aspect-[16/9] w-full overflow-hidden rounded-xl border border-border">
            <img src={universe.cover_image_url} alt={universe.title} className="h-full w-full object-cover" />
          </div>
        )}

        <div className="mb-6 flex items-center gap-2">
          <Globe2 className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          {peekLayer ? (
            <h2 className="text-balance font-serif text-xl font-semibold leading-tight sm:text-2xl">{universe.title}</h2>
          ) : (
            <h1 className="text-balance text-2xl font-bold font-serif leading-tight sm:text-3xl">{universe.title}</h1>
          )}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <Badge variant="outline">{t('story.universe')}</Badge>
          <Badge variant="secondary">{t('feed.storyCountBadge').replace(/\{\{n\}\}/g, String(stories.length))}</Badge>
          <Badge variant="secondary">{t('feed.arcCountBadge').replace(/\{\{n\}\}/g, String(arcs.length))}</Badge>
        </div>

        {universe.description && (
          <p
            className={
              peekLayer
                ? 'mb-4 line-clamp-4 whitespace-pre-wrap text-pretty text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]'
                : 'mb-6 whitespace-pre-wrap text-pretty leading-relaxed text-muted-foreground'
            }
          >
            {universe.description}
          </p>
        )}

        <div className="mb-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Library className="h-4 w-4 shrink-0" aria-hidden />
          {footer}
        </div>

        {!peekLayer && (
          <Button type="button" variant="link" className="mb-10 h-auto p-0 text-sm" onClick={onOpenFullUniverse}>
            {t('feed.openFullUniverse')}
          </Button>
        )}

        <section className={peekLayer ? 'mb-8' : 'mb-10'}>
          {peekLayer ? (
            <h3 className="mb-3 text-base font-semibold sm:text-lg">{t('universe.arcs')}</h3>
          ) : (
            <h2 className="mb-4 text-lg font-semibold">{t('universe.arcs')}</h2>
          )}
          {arcs.length === 0 ? (
            <p className="text-muted-foreground">{t('universe.noArcs')}</p>
          ) : (
            <HorizontalScrollStrip>
              {arcs.map((arc) => (
                <UniverseArcShelfTile
                  key={arc.id}
                  arc={arc}
                  storyCount={(arcStoryMap.get(arc.id) || []).length}
                  embedExploration
                  explorationPushArc={onOpenArc}
                />
              ))}
            </HorizontalScrollStrip>
          )}
        </section>

        <section>
          {peekLayer ? (
            <h3 className="mb-3 text-base font-semibold sm:text-lg">{t('universe.storiesWithoutArc')}</h3>
          ) : (
            <h2 className="mb-4 text-lg font-semibold">{t('universe.storiesWithoutArc')}</h2>
          )}
          {unassignedStories.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('universe.noStoriesWithoutArc')}</p>
          ) : (
            <HorizontalScrollStrip>
              {unassignedStories.map((story) => (
                <div key={story.id} className={browseStoryTileClassNarrow()}>
                  <StoryCard story={story} onOpenInFeedExplore={() => onOpenStory(story.id)} />
                </div>
              ))}
            </HorizontalScrollStrip>
          )}
        </section>
      </div>
    </div>
  );
}
