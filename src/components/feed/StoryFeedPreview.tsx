import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/hooks/useLanguage';
import type { Tables } from '@/integrations/supabase/types';
import type { TranslationKey } from '@/i18n/translations';
import {
  truncateText,
} from '@/lib/storyPreviewPeek';

export type StoryWithProfile = Tables<'stories'> & {
  profiles: { username: string } | null;
  universe?: { id: string; title: string } | null;
  arc?: { id: string; name: string } | null;
};

export interface StoryFeedPreviewProps {
  storyId: string;
  enabled?: boolean;
  mode?: 'peek' | 'full';
  fullPageMode?: 'link' | 'action';
  onOpenFullPage?: () => void;
  onNavigateArc?: (arcId: string) => void;
  onNavigateUniverse?: (universeId: string) => void;
  titleAs?: 'h1' | 'h2' | 'span';
}

export default function StoryFeedPreview({
  storyId,
  enabled = true,
  mode = 'full',
  fullPageMode = 'link',
  onOpenFullPage,
  onNavigateArc,
  onNavigateUniverse,
  titleAs = 'h1',
}: StoryFeedPreviewProps) {
  const { t } = useLanguage();
  const peek = mode === 'peek';
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
  const titlePeekClass = 'text-xl font-semibold font-serif leading-snug tracking-tight sm:text-2xl';
  const titleFullClass = 'text-3xl font-bold font-serif';
  const TitlePeek = 'h2' as const;

  if (loading || !story) {
    return (
      <div className={peek ? 'min-h-[28vh] py-12 text-center text-muted-foreground' : 'min-h-[40vh] bg-background p-8 text-center text-muted-foreground'}>
        {loading ? t('common.loading') : t('common.noContent')}
      </div>
    );
  }

  const prosePeek = 'prose prose-sm sm:prose-base max-w-none font-serif leading-relaxed text-foreground/90';
  const proseFull = 'prose prose-lg max-w-none font-serif leading-relaxed';

  const explorationLinks = !!(onNavigateArc || onNavigateUniverse);

  const universeBtn =
    story.universe &&
    story.universe_id &&
    explorationLinks &&
    onNavigateUniverse ? (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="h-auto rounded-md px-2 py-0.5 text-xs font-normal"
        onClick={() => onNavigateUniverse(story.universe_id!)}
      >
        {story.universe.title}
      </Button>
    ) : story.universe ? (
      <Badge variant="secondary">{story.universe.title}</Badge>
    ) : null;

  const arcBtn =
    story.arc && story.arc_id && explorationLinks && onNavigateArc ? (
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

  const badgesRowPeek = peek && explorationLinks ? null : (
    <>
      {universeBtn}
      {arcBtn}
    </>
  );

  const exploreSection =
    peek && explorationLinks && (universeBtn || arcBtn) ? (
      <div className="mt-6 border-t border-border/80 pt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('feed.peekContinueExplore')}</p>
        <div className="flex flex-wrap gap-2">
          {universeBtn}
          {arcBtn}
        </div>
      </div>
    ) : null;

  const fullPageControl =
    peek ? null : fullPageMode === 'link' ? (
      <Link href={`/story/${story.id}`} className="mt-3 inline-block text-sm text-primary hover:underline">
        {t('story.openFullPage')}
      </Link>
    ) : (
      <Button type="button" variant="link" className="mt-3 h-auto p-0 text-sm" onClick={onOpenFullPage}>
        {t('story.openFullPage')}
      </Button>
    );

  const titleNode = peek ? (
    <TitlePeek className={titlePeekClass}>{story.title}</TitlePeek>
  ) : titleAs === 'h1' ? (
    <h1 className={titleFullClass}>{story.title}</h1>
  ) : (
    <span className={titleFullClass}>{story.title}</span>
  );

  return (
    <div className={peek ? 'relative' : 'min-h-full bg-background'}>
      <div className={peek ? 'pb-2' : 'mx-auto max-w-4xl px-4 py-6 sm:px-8'}>
        <header className={peek ? 'mb-5' : 'mb-8'}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{t((`typeLabel.${storyType}`) as TranslationKey)}</Badge>
            {badgesRowPeek}
          </div>
          {titleNode}
          <p className={`mt-1.5 ${peek ? 'text-xs text-muted-foreground sm:text-sm' : 'mt-2 text-sm text-muted-foreground'}`}>
            {t('common.by')} {story.profiles?.username || t('common.anonymous')}
          </p>
          {story.description && (
            <p className={`text-foreground/80 ${peek ? 'mt-2 line-clamp-4 text-sm leading-relaxed sm:line-clamp-5 sm:text-[0.9375rem]' : 'mt-3 text-base'}`}>
              {story.description}
            </p>
          )}
          {fullPageControl}
        </header>

        {storyType === 'short_story' && peek && (
          <div className={`${prosePeek} whitespace-pre-wrap`}>{story.content || t('common.noContent')}</div>
        )}

        {storyType === 'short_story' && !peek && (
          <div className={`${proseFull} whitespace-pre-wrap`}>{story.content || t('common.noContent')}</div>
        )}

        {(storyType === 'chapters' || !storyType) && peek && (
          <div className="space-y-6">
            {chapters.map((chapter) => (
              <section key={chapter.id}>
                <h3 className="mb-2 font-serif text-lg font-semibold leading-tight">
                  Cap. {chapter.chapter_number}: {chapter.title}
                </h3>
                <div className={`${prosePeek} whitespace-pre-wrap`}>{chapter.content}</div>
              </section>
            ))}
            {chapters.length === 0 ? <p className="text-sm text-muted-foreground">{t('story.noChapters')}</p> : null}
          </div>
        )}

        {(storyType === 'chapters' || !storyType) &&
          !peek &&
          chapters.map((chapter) => (
            <section key={chapter.id}>
              <h2 className="mb-3 font-serif text-2xl font-semibold">
                Cap. {chapter.chapter_number}: {chapter.title}
              </h2>
              <div className={`${proseFull} whitespace-pre-wrap`}>{chapter.content}</div>
            </section>
          ))}

        {storyType === 'comic' && peek && (
          <div className="space-y-4">
            {comicPages.map((page) => (
              <div key={page.id} className="overflow-hidden rounded-xl border border-border">
                <img src={page.image_url} alt={`${t('story.page')} ${page.page_order}`} className="w-full object-contain" />
              </div>
            ))}
          </div>
        )}

        {storyType === 'comic' && !peek && (
          <div className="space-y-6">
            {comicPages.map((page) => (
              <div key={page.id} className="overflow-hidden rounded-xl border border-border">
                <img src={page.image_url} alt={`${t('story.page')} ${page.page_order}`} className="w-full object-contain" />
              </div>
            ))}
          </div>
        )}

        {storyType === 'illustrated' && peek && (
          <div className="space-y-6">
            {illustratedBlocks.map((block) => (
              <div key={block.id}>
                {block.block_type === 'image' ? (
                  <div className="overflow-hidden rounded-xl border border-border">
                    <img src={block.content} alt={t('story.illustration')} className="w-full object-contain" />
                  </div>
                ) : (
                  <div className={`${prosePeek} whitespace-pre-wrap`}>{block.content}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {storyType === 'illustrated' && !peek && (
          <div className="space-y-8">
            {illustratedBlocks.map((block) => (
              <div key={block.id}>
                {block.block_type === 'image' ? (
                  <div className="overflow-hidden rounded-xl border border-border">
                    <img src={block.content} alt={t('story.illustration')} className="w-full object-contain" />
                  </div>
                ) : (
                  <div className={`${proseFull} whitespace-pre-wrap`}>{block.content}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {exploreSection}
      </div>
    </div>
  );
}
