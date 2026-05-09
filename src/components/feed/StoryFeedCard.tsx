"use client";

import { Badge } from '@/components/ui/badge';
import { feedCardArticleClasses } from '@/components/feed/feedCardArticleClasses';
import { FeedClampScope, FeedClampToggle } from '@/components/feed/FeedClampedDescription';
import { useFeedExploration } from '@/components/feed/FeedExplorationContext';
import { useLanguage } from '@/hooks/useLanguage';
import { Heart, MessageCircle } from 'lucide-react';
import type { FeedStoryPayload } from '@/lib/feed';
import type { TranslationKey } from '@/i18n/translations';

interface StoryFeedCardProps {
  story: FeedStoryPayload;
  compact?: boolean;
}

function StoryFeedStatRow({
  story,
  statRowClassName,
}: {
  story: FeedStoryPayload;
  statRowClassName?: string;
}) {
  const { t } = useLanguage();

  const isolateFromCard = (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
  };

  const statButtonClass =
    "inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 text-sm tabular-nums text-muted-foreground shadow-sm transition-colors hover:bg-muted/55 hover:text-foreground active:scale-[0.99] touch-manipulation";

  return (
    <div className={statRowClassName}>
      <div className="flex max-md:flex-nowrap md:flex-wrap md:justify-start [&>*]:touch-manipulation max-md:w-full max-md:items-center max-md:justify-between">
        <div className="flex shrink-0 flex-wrap items-center gap-2 md:gap-3">
          <button
            type="button"
            className={statButtonClass}
            aria-label={`${t('feed.likeStory')}, ${story.stats.likes}`}
            onClick={isolateFromCard}
            onPointerDown={isolateFromCard}
          >
            <Heart className="h-4 w-4 shrink-0" aria-hidden />
            <span>{story.stats.likes}</span>
          </button>
          <button
            type="button"
            className={statButtonClass}
            aria-label={`${t('feed.commentStory')}, ${story.stats.comments}`}
            onClick={isolateFromCard}
            onPointerDown={isolateFromCard}
          >
            <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
            <span>{story.stats.comments}</span>
          </button>
        </div>
        <FeedClampToggle className="hidden max-md:inline-flex shrink-0" />
      </div>
    </div>
  );
}

export default function StoryFeedCard({ story, compact = false }: StoryFeedCardProps) {
  const { t } = useLanguage();
  const { pushStory } = useFeedExploration();

  const openStory = () => pushStory(story.id);

  const clampText =
    story.preview.kind === 'text'
      ? story.preview.text || story.description || t('common.noContent')
      : story.description || null;

  if (compact) {
    return (
      <button
        type="button"
        onClick={openStory}
        className="w-full rounded-xl border border-border bg-background p-3 text-left transition-colors hover:bg-accent touch-manipulation"
      >
        <div className="flex items-start gap-3">
          {story.coverImageUrl && (
            <img src={story.coverImageUrl} alt="" className="h-16 w-12 shrink-0 rounded-md object-cover border border-border" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold line-clamp-1">{story.title}</p>
            <p className="text-xs text-muted-foreground line-clamp-1">{t('common.by')} {story.author.username}</p>
            {(story.preview.text || story.description) && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {story.preview.text || story.description}
              </p>
            )}
          </div>
        </div>
      </button>
    );
  }

  return (
    <article className={feedCardArticleClasses}>
      <div
        role="button"
        tabIndex={0}
        onClick={openStory}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openStory();
          }
        }}
        className="block w-full cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {story.preview.kind === 'image' && story.preview.imageUrl ? (
          <div className="aspect-[16/10] overflow-hidden border-b border-border bg-muted">
            <img src={story.preview.imageUrl} alt="" className="h-full w-full object-cover" />
          </div>
        ) : null}

        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge variant="outline">{t((`typeLabel.${story.storyType}`) as TranslationKey)}</Badge>
            {story.universe && <Badge variant="secondary">{story.universe.title}</Badge>}
            {story.arc && <Badge variant="secondary">{story.arc.name}</Badge>}
          </div>

          <h2 className="text-2xl font-semibold font-serif leading-tight">{story.title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t('common.by')} {story.author.username}</p>
        </div>

        <div className="flex flex-col gap-4 px-5 pb-5">
          {clampText ? (
            <FeedClampScope
              text={clampText}
              className="mt-0"
              textClassName={
                story.preview.kind === 'text'
                  ? 'text-base leading-relaxed text-foreground/90'
                  : 'text-base leading-relaxed text-foreground/80'
              }
              preWrap={story.preview.kind === 'text'}
            >
              <StoryFeedStatRow story={story} statRowClassName="relative z-[2] mt-4" />
            </FeedClampScope>
          ) : (
            <StoryFeedStatRow story={story} statRowClassName="relative z-[2]" />
          )}
        </div>
      </div>
    </article>
  );
}
