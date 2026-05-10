'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { HorizontalScrollStrip } from '@/components/browse/HorizontalScrollStrip';

/** Horizontal “Netflix-style” shelf: title row + edge-aligned scroll strip (matches `container` padding). */
export function BrowseContentRow({
  title,
  description,
  actions,
  bleed = true,
  layout = 'tiles',
  className,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Pull scroll strip to viewport edges of the container (uses Tailwind `container` padding 2rem). */
  bleed?: boolean;
  /** `tiles` = this row owns horizontal scroll; `panel` = one child (e.g. nested shelf) handles scroll. */
  layout?: 'tiles' | 'panel';
  className?: string;
  children: ReactNode;
}) {
  const bleedX = bleed ? '-mx-8' : '';
  const padX = bleed ? 'px-8' : '';
  /** Scroll strip: padding + matching scroll-padding so snap does not crop the first/last card. */
  const stripPadX = bleed ? 'px-8 scroll-pl-8 scroll-pr-8' : '';

  return (
    <section className={cn('mb-10', bleedX, className)}>
      <div className={cn('mb-3 flex flex-wrap items-end justify-between gap-3', padX)}>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">{title}</h2>
          {description ? <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {layout === 'tiles' ? (
        <HorizontalScrollStrip stripClassName={stripPadX}>{children}</HorizontalScrollStrip>
      ) : (
        <div className={cn('min-w-0 max-w-full', padX)}>{children}</div>
      )}
    </section>
  );
}

/** Poster-sized tile for `StoryCard` (3:4 art). */
export function browseStoryTileClass() {
  return cn(
    'shrink-0 snap-start [-webkit-scroll-snap-stop:always] [scroll-snap-stop:always]',
    'w-[clamp(9.5rem,42vw,12.75rem)] min-w-[9.5rem] max-w-[12.75rem]',
  );
}

/** Narrower posters for shelves nested inside cards (universe arc rows, etc.). */
export function browseStoryTileClassNarrow() {
  return cn(
    'shrink-0 snap-start [-webkit-scroll-snap-stop:always] [scroll-snap-stop:always]',
    'w-[clamp(7.75rem,30vw,10.5rem)] min-w-[7.75rem] max-w-[10.5rem]',
  );
}

/** Wider landscape tile (universe / arc strip). */
export function browseLandscapeTileClass() {
  return cn(
    'shrink-0 snap-start [-webkit-scroll-snap-stop:always] [scroll-snap-stop:always]',
    'w-[min(78vw,17.5rem)] min-w-[13rem] max-w-[17.5rem]',
  );
}
