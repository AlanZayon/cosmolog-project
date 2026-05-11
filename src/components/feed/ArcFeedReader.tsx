import { useEffect, useState } from 'react';
import { BrowseContentRow, browseStoryTileClass } from '@/components/browse/BrowseContentRow';
import StoryCard from '@/components/StoryCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/hooks/useLanguage';
import type { Tables } from '@/integrations/supabase/types';
import type { TranslationKey } from '@/i18n/translations';

type Arc = Tables<'arcs'>;
type StoryWithProfile = Tables<'stories'> & { profiles: { username: string; avatar_url: string | null } | null };

export interface ArcFeedReaderProps {
  arcId: string;
  enabled?: boolean;
  /** Softer typography; hide inline “open full” (use frame footer). */
  peekLayer?: boolean;
  onOpenStory: (storyId: string) => void;
  onOpenUniverse: (universeId: string) => void;
  onOpenFullArc: () => void;
}

export default function ArcFeedReader({
  arcId,
  enabled = true,
  peekLayer = false,
  onOpenStory,
  onOpenUniverse,
  onOpenFullArc,
}: ArcFeedReaderProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [arc, setArc] = useState<Arc | null>(null);
  const [universe, setUniverse] = useState<Tables<'universes'> | null>(null);
  const [stories, setStories] = useState<StoryWithProfile[]>([]);

  useEffect(() => {
    if (!enabled || !arcId) return;
    let cancelled = false;

    const fetchArc = async () => {
      setLoading(true);
      const { data: arcData } = await supabase.from('arcs').select('*').eq('id', arcId).single();
      if (cancelled) return;

      if (!arcData) {
        setArc(null);
        setLoading(false);
        return;
      }
      setArc(arcData);

      const [{ data: universeData }, { data: storiesData }] = await Promise.all([
        supabase.from('universes').select('*').eq('id', arcData.universe_id).single(),
        supabase.from('stories').select('*').eq('arc_id', arcData.id).order('created_at', { ascending: false }),
      ]);

      if (cancelled) return;

      setUniverse(universeData);

      const authorIds = [...new Set((storiesData || []).map((s) => s.author_id))];
      let profileMap = new Map<string, { username: string; avatar_url: string | null }>();
      if (authorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, username, avatar_url')
          .in('user_id', authorIds);
        profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);
      }

      setStories((storiesData || []).map((s) => ({ ...s, profiles: profileMap.get(s.author_id) || null })));
      setLoading(false);
    };

    void fetchArc();
    return () => {
      cancelled = true;
    };
  }, [arcId, enabled]);

  if (loading) {
    return (
      <div className="min-h-[40vh] p-8 text-center text-muted-foreground">{t('common.loading')}</div>
    );
  }

  if (!arc) {
    return (
      <div className="min-h-[40vh] p-8 text-center text-muted-foreground">{t('universe.notFound')}</div>
    );
  }

  const storyCountLabel = t('feed.storyCountBadge').replace(/\{\{n\}\}/g, String(stories.length));

  if (peekLayer) {
    return (
      <div className="relative">
        <div className="mx-auto min-w-0 max-w-none px-0 py-0">
          {universe ? (
            <div className="mb-6">
              <Button type="button" variant="link" className="h-auto p-0 text-sm text-primary" onClick={() => onOpenUniverse(universe.id)}>
                {t('story.universe')}: {universe.title}
              </Button>
            </div>
          ) : null}

          <div className="relative mb-10">
            {arc.cover_image_url ? (
              <div className="relative overflow-hidden border border-border sm:rounded-2xl">
                <div className="relative aspect-[2/1] min-h-[12rem] max-h-[min(44vh,22rem)] w-full sm:aspect-[21/9] sm:max-h-[min(48vh,26rem)]">
                  <img src={arc.cover_image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-background from-[38%] via-background/65 to-transparent" aria-hidden />
                  <div className="absolute inset-0 bg-gradient-to-r from-background/85 via-transparent to-transparent sm:from-background/70" aria-hidden />
                </div>
                <div className="absolute inset-x-0 bottom-0 space-y-2 p-5 md:p-8">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{t(`arcType.${arc.type}` as TranslationKey)}</Badge>
                    <Badge variant="secondary">{storyCountLabel}</Badge>
                    {universe ? <Badge variant="secondary">{universe.title}</Badge> : null}
                  </div>
                  <h2 className="text-balance font-serif text-2xl font-bold tracking-tight sm:text-4xl">{arc.name}</h2>
                  {arc.description ? (
                    <p className="max-w-3xl text-pretty text-sm leading-relaxed text-foreground/85 line-clamp-4 sm:text-base">{arc.description}</p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-gradient-to-br from-card via-background to-muted/40 p-6 md:p-8">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{t(`arcType.${arc.type}` as TranslationKey)}</Badge>
                  <Badge variant="secondary">{storyCountLabel}</Badge>
                  {universe ? <Badge variant="secondary">{universe.title}</Badge> : null}
                </div>
                <h2 className="mt-3 text-balance font-serif text-2xl font-bold tracking-tight sm:text-4xl">{arc.name}</h2>
                {arc.description ? <p className="mt-3 max-w-3xl text-pretty text-foreground/80">{arc.description}</p> : null}
              </div>
            )}
          </div>

          {stories.length === 0 ? (
            <p className="text-muted-foreground">{t('universe.arcStoriesEmpty')}</p>
          ) : (
            <BrowseContentRow title={t('arc.storiesInArc')} bleed={false}>
              {stories.map((story) => (
                <div key={story.id} className={browseStoryTileClass()}>
                  <StoryCard story={story} onOpenInFeedExplore={() => onOpenStory(story.id)} />
                </div>
              ))}
            </BrowseContentRow>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
        {universe && (
          <Button type="button" variant="link" className="h-auto p-0 text-sm text-primary" onClick={() => onOpenUniverse(universe.id)}>
            {t('story.universe')}: {universe.title}
          </Button>
        )}

        <section className="mt-4 mb-6 overflow-hidden rounded-2xl border border-border bg-card">
          {arc.cover_image_url && (
            <div className="aspect-[16/6] overflow-hidden border-b border-border">
              <img src={arc.cover_image_url} alt={arc.name} className="h-full w-full object-cover" />
            </div>
          )}
          <div className="p-6">
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge variant="outline">{t(`arcType.${arc.type}` as TranslationKey)}</Badge>
              <Badge variant="secondary">{storyCountLabel}</Badge>
              {universe && <Badge variant="secondary">{universe.title}</Badge>}
            </div>
            <h1 className="font-serif text-3xl font-bold">{arc.name}</h1>
            {arc.description && <p className="mt-3 max-w-2xl text-foreground/80">{arc.description}</p>}
            <Button type="button" variant="link" className="mt-3 h-auto p-0 text-sm" onClick={onOpenFullArc}>
              {t('feed.openFullArc')}
            </Button>
          </div>
        </section>

        {stories.length === 0 ? (
          <p className="text-muted-foreground">{t('universe.arcStoriesEmpty')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {stories.map((story) => (
              <StoryCard key={story.id} story={story} onOpenInFeedExplore={() => onOpenStory(story.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
