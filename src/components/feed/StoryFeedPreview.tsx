import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/hooks/useLanguage';
import type { Tables } from '@/integrations/supabase/types';
import type { TranslationKey } from '@/i18n/translations';

export type StoryWithProfile = Tables<'stories'> & {
  profiles: { username: string } | null;
  universe?: { id: string; title: string } | null;
  arc?: { id: string; name: string } | null;
};

export interface StoryFeedPreviewProps {
  storyId: string;
  /** When false, skips fetch (e.g. shell not showing story yet). */
  enabled?: boolean;
  /** Use native link for full page vs button that calls `onOpenFullPage`. */
  fullPageMode?: 'link' | 'action';
  onOpenFullPage?: () => void;
  onNavigateArc?: (arcId: string) => void;
  onNavigateUniverse?: (universeId: string) => void;
  /** Optional title wrapper for a11y (dialog vs page). */
  titleAs?: 'h1' | 'span';
}

export default function StoryFeedPreview({
  storyId,
  enabled = true,
  fullPageMode = 'link',
  onOpenFullPage,
  onNavigateArc,
  onNavigateUniverse,
  titleAs = 'h1',
}: StoryFeedPreviewProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [story, setStory] = useState<StoryWithProfile | null>(null);
  const [chapters, setChapters] = useState<Tables<'chapters'>[]>([]);
  const [comicPages, setComicPages] = useState<Tables<'comic_pages'>[]>([]);
  const [illustratedBlocks, setIllustratedBlocks] = useState<Tables<'illustrated_blocks'>[]>([]);

  useEffect(() => {
    if (!enabled || !storyId) return;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      const { data } = await supabase.from('stories').select('*').eq('id', storyId).single();
      const storyData = data as Tables<'stories'> | null;

      if (cancelled) return;

      if (!storyData) {
        setStory(null);
        setLoading(false);
        return;
      }

      const [{ data: profile }, { data: universe }, { data: arc }] = await Promise.all([
        supabase.from('profiles').select('username').eq('user_id', storyData.author_id).single(),
        storyData.universe_id
          ? supabase.from('universes').select('id, title').eq('id', storyData.universe_id).single()
          : Promise.resolve({ data: null }),
        storyData.arc_id
          ? supabase.from('arcs').select('id, name').eq('id', storyData.arc_id).single()
          : Promise.resolve({ data: null }),
      ]);

      if (cancelled) return;

      setStory({ ...storyData, profiles: profile, universe, arc } as StoryWithProfile);

      if (storyData.type === 'chapters' || !storyData.type) {
        const { data: ch } = await supabase.from('chapters').select('*').eq('story_id', storyId).order('chapter_number');
        if (!cancelled) setChapters(ch || []);
      } else {
        setChapters([]);
      }

      if (storyData.type === 'comic') {
        const { data: pages } = await supabase.from('comic_pages').select('*').eq('story_id', storyId).order('page_order');
        if (!cancelled) setComicPages(pages || []);
      } else {
        setComicPages([]);
      }

      if (storyData.type === 'illustrated') {
        const { data: blocks } = await supabase
          .from('illustrated_blocks')
          .select('*')
          .eq('story_id', storyId)
          .order('block_order');
        if (!cancelled) setIllustratedBlocks(blocks || []);
      } else {
        setIllustratedBlocks([]);
      }

      if (!cancelled) setLoading(false);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [enabled, storyId]);

  const storyType = story?.type || 'chapters';
  const TitleTag = titleAs === 'h1' ? 'h1' : 'span';

  if (loading || !story) {
    return (
      <div className="min-h-[40vh] bg-background p-8 text-center text-muted-foreground">
        {loading ? t('common.loading') : t('common.noContent')}
      </div>
    );
  }

  const universeBadge =
    story.universe &&
    (onNavigateUniverse && story.universe_id ? (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="h-auto rounded-md px-2 py-0.5 text-xs font-normal"
        onClick={() => onNavigateUniverse(story.universe_id!)}
      >
        {story.universe.title}
      </Button>
    ) : (
      <Badge variant="secondary">{story.universe.title}</Badge>
    ));

  const arcBadge =
    story.arc &&
    story.arc_id &&
    onNavigateArc ? (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="h-auto rounded-md px-2 py-0.5 text-xs font-normal"
        onClick={() => onNavigateArc(story.arc_id!)}
      >
        {story.arc.name}
      </Button>
    ) : story.arc ? (
      <Badge variant="secondary">{story.arc.name}</Badge>
    ) : null;

  const fullPageControl =
    fullPageMode === 'link' ? (
      <Link href={`/story/${story.id}`} className="text-sm text-primary hover:underline mt-3 inline-block">
        {t('story.openFullPage')}
      </Link>
    ) : (
      <Button type="button" variant="link" className="mt-3 h-auto p-0 text-sm" onClick={onOpenFullPage}>
        {t('story.openFullPage')}
      </Button>
    );

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8">
        <header className="mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge variant="outline">{t((`typeLabel.${storyType}`) as TranslationKey)}</Badge>
            {universeBadge}
            {arcBadge}
          </div>
          <TitleTag className="text-3xl font-bold font-serif">{story.title}</TitleTag>
          <p className="text-sm text-muted-foreground mt-2">
            {t('common.by')} {story.profiles?.username || t('common.anonymous')}
          </p>
          {story.description && <p className="text-base text-foreground/80 mt-3">{story.description}</p>}
          {fullPageControl}
        </header>

        {storyType === 'short_story' && (
          <div className="prose prose-lg max-w-none font-serif leading-relaxed whitespace-pre-wrap">
            {story.content || t('common.noContent')}
          </div>
        )}

        {(storyType === 'chapters' || !storyType) && (
          <div className="space-y-8">
            {chapters.map((chapter) => (
              <section key={chapter.id}>
                <h2 className="text-2xl font-semibold font-serif mb-3">
                  Cap. {chapter.chapter_number}: {chapter.title}
                </h2>
                <div className="prose prose-lg max-w-none font-serif leading-relaxed whitespace-pre-wrap">{chapter.content}</div>
              </section>
            ))}
          </div>
        )}

        {storyType === 'comic' && (
          <div className="space-y-6">
            {comicPages.map((page) => (
              <div key={page.id} className="rounded-xl overflow-hidden border border-border">
                <img src={page.image_url} alt={`${t('story.page')} ${page.page_order}`} className="w-full object-contain" />
              </div>
            ))}
          </div>
        )}

        {storyType === 'illustrated' && (
          <div className="space-y-8">
            {illustratedBlocks.map((block) => (
              <div key={block.id}>
                {block.block_type === 'image' ? (
                  <div className="rounded-xl overflow-hidden border border-border">
                    <img src={block.content} alt={t('story.illustration')} className="w-full object-contain" />
                  </div>
                ) : (
                  <div className="prose prose-lg max-w-none font-serif leading-relaxed whitespace-pre-wrap">{block.content}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
