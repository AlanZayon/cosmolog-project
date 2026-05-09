import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/hooks/useLanguage';
import StoryCard from '@/components/StoryCard';
import { Globe2, Library } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

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
  onOpenArc: (arcId: string) => void;
  onOpenStory: (storyId: string) => void;
  onOpenFullUniverse: () => void;
}

export default function UniverseFeedReader({
  universeId,
  enabled = true,
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
        supabase.from('arcs').select('*').eq('universe_id', universeId).order('created_at', { ascending: false }),
        supabase.from('stories').select('*').eq('universe_id', universeId).order('created_at', { ascending: false }),
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
    return groups;
  }, [stories]);

  const unassignedStories = useMemo(() => stories.filter((s) => !s.arc_id), [stories]);

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
    <div className="min-h-full bg-background">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
        {universe.cover_image_url && (
          <div className="mb-4 aspect-[16/9] w-full overflow-hidden rounded-xl border border-border">
            <img src={universe.cover_image_url} alt={universe.title} className="h-full w-full object-cover" />
          </div>
        )}

        <div className="mb-6 flex items-center gap-2">
          <Globe2 className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          <h1 className="text-balance text-2xl font-bold font-serif leading-tight sm:text-3xl">{universe.title}</h1>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <Badge variant="outline">{t('story.universe')}</Badge>
          <Badge variant="secondary">{t('feed.storyCountBadge').replace(/\{\{n\}\}/g, String(stories.length))}</Badge>
          <Badge variant="secondary">{t('feed.arcCountBadge').replace(/\{\{n\}\}/g, String(arcs.length))}</Badge>
        </div>

        {universe.description && (
          <p className="mb-6 whitespace-pre-wrap text-pretty leading-relaxed text-muted-foreground">{universe.description}</p>
        )}

        <div className="mb-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Library className="h-4 w-4 shrink-0" aria-hidden />
          {footer}
        </div>

        <Button type="button" variant="link" className="mb-10 h-auto p-0 text-sm" onClick={onOpenFullUniverse}>
          {t('feed.openFullUniverse')}
        </Button>

        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold">{t('universe.arcs')}</h2>
          {arcs.length === 0 ? (
            <p className="text-muted-foreground">{t('universe.noArcs')}</p>
          ) : (
            <div className="space-y-4">
              {arcs.map((arc) => {
                const arcStories = arcStoryMap.get(arc.id) || [];
                return (
                  <div key={arc.id} className="overflow-hidden rounded-xl border border-border bg-card">
                    {arc.cover_image_url && (
                      <div className="aspect-[16/5] overflow-hidden border-b border-border">
                        <img src={arc.cover_image_url} alt="" className="h-full w-full object-cover" />
                      </div>
                    )}
                    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <h3 className="font-semibold leading-snug">{arc.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {t('feed.storyCountBadge').replace(/\{\{n\}\}/g, String(arcStories.length))}
                        </p>
                      </div>
                      <Button type="button" variant="outline" size="sm" className="shrink-0 touch-manipulation" onClick={() => onOpenArc(arc.id)}>
                        {t('feed.exploreArc')}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold">{t('universe.storiesWithoutArc')}</h2>
          {unassignedStories.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('universe.noStoriesWithoutArc')}</p>
          ) : (
            <div
              className={cn(
                '-mx-1 flex flex-nowrap gap-3 overflow-x-auto px-1 pb-2 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                'snap-x snap-mandatory sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 md:grid-cols-4 sm:overflow-visible sm:px-0 sm:pb-0 sm:snap-none',
              )}
            >
              {unassignedStories.map((story) => (
                <div
                  key={story.id}
                  className={cn(
                    'shrink-0 snap-start sm:w-auto sm:min-w-0 sm:shrink',
                    'w-[clamp(9.75rem,40vw,13.5rem)] min-w-[9.75rem] max-w-[13.5rem] sm:max-w-none',
                  )}
                >
                  <StoryCard story={story} onOpenInFeedExplore={() => onOpenStory(story.id)} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
