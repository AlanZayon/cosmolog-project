"use client";

import { useFeedExploration } from '@/components/feed/FeedExplorationContext';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/hooks/useLanguage';
import { Globe2, Library } from 'lucide-react';
import type { FeedUniversePayload } from '@/lib/feed';
import type { TranslationKey } from '@/i18n/translations';
import { FeedClampScope, FeedClampToggle } from '@/components/feed/FeedClampedDescription';
import { feedCardArticleClasses } from '@/components/feed/feedCardArticleClasses';
import { cn } from '@/lib/utils';

function fillN(key: TranslationKey, n: number, t: (k: TranslationKey) => string) {
  return t(key).replace(/\{\{n\}\}/g, String(n));
}

interface UniverseFeedCardProps {
  universe: FeedUniversePayload;
}

export default function UniverseFeedCard({ universe }: UniverseFeedCardProps) {
  const { t } = useLanguage();
  const { pushUniverse } = useFeedExploration();
  const open = () => pushUniverse(universe.id);

  const footer = t('feed.universeFooterCounts')
    .replace(/\{\{stories\}\}/g, String(universe.storyCount))
    .replace(/\{\{arcs\}\}/g, String(universe.arcCount ?? 0));

  return (
    <article
      className={cn(
        feedCardArticleClasses,
        'cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      )}
      role="link"
      tabIndex={0}
      aria-label={`${universe.title} — ${footer}`}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
    >
      <div className="aspect-[16/8] overflow-hidden bg-muted border-b border-border pointer-events-none">
        {universe.coverImageUrl ? (
          <img src={universe.coverImageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full gradient-hero flex items-center justify-center">
            <Globe2 className="h-10 w-10 text-primary-foreground/40" />
          </div>
        )}
      </div>

      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2 mb-3 pointer-events-none">
          <Badge variant="outline">{t('story.universe')}</Badge>
          <Badge variant="secondary">{fillN('feed.storyCountBadge', universe.storyCount, t)}</Badge>
          <Badge variant="secondary">{fillN('feed.arcCountBadge', universe.arcCount ?? 0, t)}</Badge>
        </div>

        <h2 className="text-2xl font-semibold font-serif leading-tight pointer-events-none">{universe.title}</h2>
        {universe.tagline ? (
          <FeedClampScope
            text={universe.tagline}
            className="mt-3"
            textClassName="text-base leading-relaxed text-foreground/80"
          >
            <div className="relative z-[2] mt-5 flex max-md:flex-nowrap md:flex-wrap md:flex-col md:items-start max-md:w-full max-md:items-center max-md:justify-between md:gap-2">
              <div className="pointer-events-none flex min-h-[2.75rem] shrink-0 items-center gap-2 text-sm text-muted-foreground">
                <Library className="h-4 w-4 shrink-0" /> {footer}
              </div>
              <FeedClampToggle className="hidden max-md:inline-flex shrink-0" />
            </div>
          </FeedClampScope>
        ) : (
          <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground pointer-events-none">
            <Library className="h-4 w-4 shrink-0" /> {footer}
          </div>
        )}
      </div>
    </article>
  );
}
