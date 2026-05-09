import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/hooks/useLanguage';
import StoryCard from '@/components/StoryCard';
import type { Tables } from '@/integrations/supabase/types';
import type { TranslationKey } from '@/i18n/translations';

type Arc = Tables<'arcs'>;
type StoryWithProfile = Tables<'stories'> & { profiles: { username: string; avatar_url: string | null } | null };

export interface ArcFeedReaderProps {
  arcId: string;
  enabled?: boolean;
  onOpenStory: (storyId: string) => void;
  onOpenUniverse: (universeId: string) => void;
  onOpenFullArc: () => void;
}

export default function ArcFeedReader({
  arcId,
  enabled = true,
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

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
        {universe && (
          <Button type="button" variant="link" className="h-auto p-0 text-sm text-primary" onClick={() => onOpenUniverse(universe.id)}>
            {t('story.universe')}: {universe.title}
          </Button>
        )}

        <section className="mt-4 mb-8 rounded-2xl border border-border bg-card overflow-hidden">
          {arc.cover_image_url && (
            <div className="aspect-[16/6] overflow-hidden border-b border-border">
              <img src={arc.cover_image_url} alt={arc.name} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="p-6">
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge variant="outline">{t(`arcType.${arc.type}` as TranslationKey)}</Badge>
              <Badge variant="secondary">{stories.length}</Badge>
              {universe && <Badge variant="secondary">{universe.title}</Badge>}
            </div>
            <h1 className="text-3xl font-bold font-serif">{arc.name}</h1>
            {arc.description && <p className="mt-3 text-foreground/80 max-w-2xl">{arc.description}</p>}
            <Button type="button" variant="link" className="mt-3 h-auto p-0 text-sm" onClick={onOpenFullArc}>
              {t('feed.openFullArc')}
            </Button>
          </div>
        </section>

        {stories.length === 0 ? (
          <p className="text-muted-foreground">{t('universe.arcStoriesEmpty')}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {stories.map((story) => (
              <StoryCard key={story.id} story={story} onOpenInFeedExplore={() => onOpenStory(story.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
