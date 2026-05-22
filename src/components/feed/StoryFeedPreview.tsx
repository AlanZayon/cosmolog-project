import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  getArc,
  getProfileByUserId,
  getStoryById,
  getStoryChapters,
  getComicPages,
  getUniverseById,
} from '@/lib/api';
import { getBlocks } from '@/lib/api/content';
import { useLanguage } from '@/hooks/useLanguage';
import type { Tables } from '@/integrations/supabase/types';
import type { TranslationKey } from '@/i18n/translations';
import { PEEK_ILLUSTRATED_BLOCKS } from '@/lib/storyPreviewPeek';
import { loadBlocks, normalizeStoryType, type StoryBlockRow } from '@/lib/storyBlocks';
import StoryBlocksView from '@/components/StoryBlocksView';

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

function FeedBlocksList({
  blocks,
  peek,
  prosePeek,
}: {
  blocks: StoryBlockRow[];
  peek: boolean;
  prosePeek: string;
}) {
  const { t } = useLanguage();
  const visible = peek ? blocks.slice(0, PEEK_ILLUSTRATED_BLOCKS) : blocks;

  if (visible.length === 0) return null;

  if (!peek) {
    return <StoryBlocksView blocks={visible} className="space-y-8" />;
  }

  return (
    <div className="space-y-6">
      {visible.map((block) => (
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
  );
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
  const [shortStoryBlocks, setShortStoryBlocks] = useState<StoryBlockRow[]>([]);
  const [chapterBlocksMap, setChapterBlocksMap] = useState<Record<string, StoryBlockRow[]>>({});

  useEffect(() => {
    if (!enabled || !storyId) return;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      const storyData = await getStoryById(storyId);

      if (cancelled) return;

      const [profile, universe, arc] = await Promise.all([
        getProfileByUserId(storyData.author_id).catch(() => null),
        storyData.universe_id
          ? getUniverseById(storyData.universe_id).catch(() => null)
          : Promise.resolve(null),
        storyData.arc_id ? getArc(storyData.arc_id).catch(() => null) : Promise.resolve(null),
      ]);

      if (cancelled) return;

      setStory({
        ...storyData,
        profiles: profile ? { username: profile.username } : null,
        universe: universe ? { id: universe.id, title: universe.title } : null,
        arc: arc ? { id: arc.id, name: arc.name } : null,
      } as StoryWithProfile);

      const normalizedType = normalizeStoryType(storyData.type);

      if (normalizedType === 'chapters') {
        const ch = await getStoryChapters(storyId);
        if (!cancelled) setChapters(ch as Tables<'chapters'>[]);

        const map: Record<string, StoryBlockRow[]> = {};
        for (const chapter of ch) {
          const blocks = await getBlocks(storyId, chapter.id);
          map[chapter.id] = blocks as StoryBlockRow[];
        }
        if (!cancelled) setChapterBlocksMap(map);
      } else {
        setChapters([]);
        setChapterBlocksMap({});
      }

      if (normalizedType === 'comic') {
        const pages = await getComicPages(storyId);
        if (!cancelled) setComicPages(pages as Tables<'comic_pages'>[]);
      } else {
        setComicPages([]);
      }

      if (normalizedType === 'short_story') {
        const blocks = await loadBlocks(storyId, null);
        if (!cancelled) setShortStoryBlocks(blocks);
      } else {
        setShortStoryBlocks([]);
      }

      if (!cancelled) setLoading(false);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [enabled, storyId]);

  const storyType = normalizeStoryType(story?.type);
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

  const renderChapterBody = (chapter: Tables<'chapters'>) => {
    const blocks = chapterBlocksMap[chapter.id] || [];
    if (blocks.length > 0) {
      return <FeedBlocksList blocks={blocks} peek={peek} prosePeek={prosePeek} />;
    }
    const proseClass = peek ? prosePeek : proseFull;
    return (
      <div className={`${proseClass} whitespace-pre-wrap`}>
        {chapter.content || (peek ? null : t('common.noContent'))}
      </div>
    );
  };

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

        {storyType === 'short_story' && (
          shortStoryBlocks.length > 0 ? (
            <FeedBlocksList blocks={shortStoryBlocks} peek={peek} prosePeek={prosePeek} />
          ) : (
            <div className={`${peek ? prosePeek : proseFull} whitespace-pre-wrap`}>
              {story.content || t('common.noContent')}
            </div>
          )
        )}

        {storyType === 'chapters' && peek && (
          <div className="space-y-6">
            {chapters.map((chapter) => (
              <section key={chapter.id}>
                <h3 className="mb-2 font-serif text-lg font-semibold leading-tight">
                  {chapter.title}
                </h3>
                {renderChapterBody(chapter)}
              </section>
            ))}
            {chapters.length === 0 ? <p className="text-sm text-muted-foreground">{t('story.noChapters')}</p> : null}
          </div>
        )}

        {storyType === 'chapters' &&
          !peek &&
          chapters.map((chapter) => (
            <section key={chapter.id} className="mb-10">
              <h2 className="mb-3 font-serif text-2xl font-semibold">
                {chapter.title}
              </h2>
              {renderChapterBody(chapter)}
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

        {exploreSection}
      </div>
    </div>
  );
}
