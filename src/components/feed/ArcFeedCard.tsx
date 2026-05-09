"use client";

import { useFeedExploration } from '@/components/feed/FeedExplorationContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/useLanguage';
import StoryFeedCard from '@/components/feed/StoryFeedCard';
import { ChevronDown, ChevronUp, Layers3 } from 'lucide-react';
import type { FeedArcPayload, FeedStoryPayload } from '@/lib/feed';
import type { TranslationKey } from '@/i18n/translations';
import { FeedClampScope, FeedClampToggle } from '@/components/feed/FeedClampedDescription';
import { feedCardArticleClasses } from '@/components/feed/feedCardArticleClasses';
import { cn } from '@/lib/utils';

function fillN(key: TranslationKey, n: number, t: (k: TranslationKey) => string) {
  return t(key).replace(/\{\{n\}\}/g, String(n));
}

interface ArcFeedCardProps {
  arc: FeedArcPayload;
  expanded: boolean;
  onToggle: () => void;
}

export default function ArcFeedCard({ arc, expanded, onToggle }: ArcFeedCardProps) {
  const { t } = useLanguage();
  const { pushArc } = useFeedExploration();

  const openArcPreview = () => {
    pushArc(arc.id);
  };

  return (
    <article
      tabIndex={0}
      aria-label={arc.name}
      className={cn(
        feedCardArticleClasses,
        'cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      )}
      onClick={openArcPreview}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openArcPreview();
        }
      }}
    >
      {arc.coverImageUrl && (
        <div className="aspect-[16/7] overflow-hidden border-b border-border bg-muted pointer-events-none">
          <img src={arc.coverImageUrl} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 text-left pointer-events-none">
            <div className="pointer-events-none flex flex-wrap items-center gap-2 mb-3">
              <Badge variant="outline">{t(`arcType.${arc.arcType}` as TranslationKey)}</Badge>
              <Badge variant="secondary">{fillN('feed.storyCountBadge', arc.storyCount, t)}</Badge>
              <Badge variant="secondary">{arc.universe.title}</Badge>
            </div>
            <h2 className="text-2xl font-semibold font-serif leading-tight">{arc.name}</h2>
          </div>

          <div
            className="relative z-[3] shrink-0"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Button
              type="button"
              variant="outline"
              size="icon"
              title={expanded ? t('feed.collapseArc') : t('feed.expandArc')}
              aria-label={expanded ? t('feed.collapseArc') : t('feed.expandArc')}
              aria-expanded={expanded}
              aria-controls={`arc-feed-stories-${arc.id}`}
              id={`arc-expand-${arc.id}`}
              className="h-11 w-11 touch-manipulation rounded-lg border-border shadow-sm hover:bg-accent"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggle();
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {expanded ? (
                <ChevronUp className="h-5 w-5" aria-hidden />
              ) : (
                <ChevronDown className="h-5 w-5" aria-hidden />
              )}
            </Button>
          </div>
        </div>

        <div className="mt-3 pointer-events-auto">
          {arc.description ? (
            <FeedClampScope
              text={arc.description}
              className="mt-0"
              textClassName="text-base leading-relaxed text-foreground/80"
            >
              <div className="relative z-[2] mt-5 flex max-md:flex-nowrap md:flex-wrap md:flex-col md:items-start max-md:w-full max-md:items-center max-md:justify-between md:gap-2">
                <div className="pointer-events-none flex min-h-[2.75rem] shrink-0 items-center gap-2 text-sm text-muted-foreground">
                  <Layers3 className="h-4 w-4 shrink-0" aria-hidden />{' '}
                  {fillN('feed.storyCountBadge', arc.storyCount, t)}
                </div>
                <FeedClampToggle className="hidden max-md:inline-flex shrink-0" />
              </div>
            </FeedClampScope>
          ) : null}
        </div>

        {!arc.description ? (
          <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground pointer-events-none">
            <Layers3 className="h-4 w-4 shrink-0" aria-hidden /> {fillN('feed.storyCountBadge', arc.storyCount, t)}
          </div>
        ) : null}

        {expanded && (
          <div
            id={`arc-feed-stories-${arc.id}`}
            role="region"
            aria-labelledby={`arc-expand-${arc.id}`}
            className="mt-5 space-y-3 border-t border-border pt-4"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {arc.stories.map((story) => (
              <StoryFeedCard
                key={story.id}
                compact
                story={{
                  id: story.id,
                  title: story.title,
                  description: null,
                  storyType: story.storyType,
                  coverImageUrl: story.coverImageUrl,
                  author: {
                    id: '',
                    username: story.author.username,
                    avatarUrl: story.author.avatarUrl,
                  },
                  universe: arc.universe,
                  arc: { id: arc.id, name: arc.name, type: arc.arcType },
                  preview: { kind: 'text', text: null, imageUrl: null },
                  stats: { likes: 0, comments: 0 },
                  createdAt: '',
                } satisfies FeedStoryPayload}
              />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
