'use client';

import Link from 'next/link';
import { Layers, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/useLanguage';
import type { Tables } from '@/integrations/supabase/types';
import type { TranslationKey } from '@/i18n/translations';

type Arc = Tables<'arcs'>;

const tileClassName = cn(
  'shrink-0 snap-start [-webkit-scroll-snap-stop:always] [scroll-snap-stop:always]',
  'flex w-[min(72vw,15.5rem)] min-w-[12.5rem] max-w-[15.5rem] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md',
);

export function UniverseArcShelfTile({
  arc,
  storyCount,
  isOwner = false,
  embedExploration = false,
  explorationPushArc,
  onEdit,
  onDelete,
}: {
  arc: Arc;
  storyCount: number;
  isOwner?: boolean;
  embedExploration?: boolean;
  explorationPushArc?: (arcId: string) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { t } = useLanguage();
  const explore = () => explorationPushArc?.(arc.id);
  const exploreOnly = Boolean(embedExploration && explorationPushArc);
  const showExploreFooter = Boolean(explorationPushArc && !embedExploration);

  const meta = (
    <div className="flex flex-1 flex-col gap-1 p-3 pt-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-primary">{t(`arcType.${arc.type}` as TranslationKey)}</p>
      <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-foreground">{arc.name}</h3>
      <p className="mt-auto text-xs text-muted-foreground">{t('feed.storyCountBadge').replace(/\{\{n\}\}/g, String(storyCount))}</p>
    </div>
  );

  const cover = (
    <div className="aspect-[5/6] w-full shrink-0 bg-muted/40">
      {arc.cover_image_url ? (
        <img src={arc.cover_image_url} alt="" className="h-full w-full object-cover [-webkit-touch-callout:none]" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center text-muted-foreground">
          <Layers className="h-10 w-10 opacity-50" aria-hidden />
        </div>
      )}
    </div>
  );

  const ownerOverlay =
    isOwner && !embedExploration && (onEdit || onDelete) ? (
      <div className="absolute right-1.5 top-1.5 z-10 flex gap-1">
        {onEdit ? (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-8 w-8 touch-manipulation border border-border/80 shadow-sm"
            onClick={(e) => {
              e.preventDefault();
              onEdit();
            }}
            aria-label={t('common.edit')}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
          </Button>
        ) : null}
        {onDelete ? (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-8 w-8 touch-manipulation border border-border/80 text-destructive shadow-sm hover:text-destructive"
            onClick={(e) => {
              e.preventDefault();
              onDelete();
            }}
            aria-label={t('common.delete')}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </Button>
        ) : null}
      </div>
    ) : null;

  if (exploreOnly) {
    return (
      <div className={tileClassName}>
        <div className="relative flex min-h-0 flex-1 flex-col">
          <button
            type="button"
            className="flex w-full min-w-0 flex-1 flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onClick={explore}
          >
            {cover}
            {meta}
          </button>
          {ownerOverlay}
        </div>
      </div>
    );
  }

  return (
    <div className={tileClassName}>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <Link
          href={`/arc/${arc.id}`}
          className="flex min-h-0 flex-1 flex-col rounded-t-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {cover}
          {meta}
        </Link>
        {ownerOverlay}
      </div>
      {showExploreFooter ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="touch-manipulation rounded-none border-x-0 border-b-0 border-t border-border text-xs"
          onClick={explore}
        >
          {t('feed.exploreArc')}
        </Button>
      ) : null}
    </div>
  );
}
