'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { browseLandscapeTileClass, browseStoryTileClass } from '@/components/browse/BrowseContentRow';
import { cn } from '@/lib/utils';

/** Generic centered content area placeholder. */
export function PageContentSkeleton({
  className,
  rows = 4,
}: {
  className?: string;
  rows?: number;
}) {
  return (
    <div className={cn('space-y-4 py-6', className)} aria-hidden>
      <Skeleton className="h-8 w-2/3 max-w-sm" />
      <Skeleton className="h-4 w-full max-w-xl" />
      <Skeleton className="h-4 w-5/6 max-w-lg" />
      {Array.from({ length: Math.max(0, rows - 2) }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-xl" />
      ))}
    </div>
  );
}

/** Single feed card matching StoryFeedCard / UniverseFeedCard footprint. */
export function FeedCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-border bg-card shadow-sm',
        className,
      )}
      aria-hidden
    >
      <Skeleton className="aspect-[16/10] w-full rounded-none" />
      <div className="space-y-3 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-7 w-3/4 max-w-md" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-9 w-20 rounded-lg" />
          <Skeleton className="h-9 w-16 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function FeedListSkeleton({
  count = 3,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn('space-y-6', className)} aria-busy="true" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <FeedCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Horizontal shelf of story poster tiles. */
export function StoryShelfSkeleton({
  count = 5,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <section className={cn('mb-10', className)} aria-busy="true" aria-hidden>
      <Skeleton className="mb-3 h-6 w-36" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={browseStoryTileClass()}>
            <Skeleton className="aspect-[3/4] w-full rounded-xl" />
            <Skeleton className="mt-2 h-4 w-[80%]" />
            <Skeleton className="mt-1.5 h-3 w-1/2" />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Horizontal shelf of landscape tiles (universes). */
export function LandscapeShelfSkeleton({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <section className={cn('mb-10', className)} aria-busy="true" aria-hidden>
      <Skeleton className="mb-3 h-6 w-40" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={browseLandscapeTileClass()}>
            <Skeleton className="aspect-[16/10] w-full rounded-xl" />
            <Skeleton className="mt-2 h-4 w-3/4" />
            <Skeleton className="mt-1.5 h-3 w-full" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function ProfileHeroSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative mb-10 overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-background to-muted/40 shadow-card',
        className,
      )}
      aria-busy="true"
      aria-hidden
    >
      <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:gap-8 md:p-8">
        <Skeleton className="h-24 w-24 shrink-0 rounded-full sm:h-28 sm:w-28" />
        <div className="min-w-0 flex-1 space-y-3">
          <Skeleton className="h-8 w-48 max-w-full" />
          <Skeleton className="h-4 w-full max-w-md" />
          <Skeleton className="h-4 w-2/3 max-w-sm" />
          <Skeleton className="mt-2 h-8 w-28 rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function StoryReaderSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-8 py-2', className)} aria-busy="true" aria-hidden>
      <div className="space-y-4">
        <Skeleton className="aspect-[3/4] w-full max-w-[200px] rounded-lg" />
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-9 w-3/4 max-w-md" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <div className="flex gap-3 pt-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-16 rounded-lg" />
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
    </div>
  );
}

/** Body-only skeleton once story meta is known (chapters / blocks / pages). */
export function StoryBodySkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('mb-8 space-y-3', className)} aria-busy="true" aria-hidden>
      <Skeleton className="h-5 w-36" />
      <Skeleton className="h-14 w-full rounded-lg" />
      <Skeleton className="h-14 w-full rounded-lg" />
      <Skeleton className="h-14 w-full rounded-lg" />
    </div>
  );
}

export function ChapterBodySkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('mt-6 space-y-3', className)} aria-busy="true" aria-hidden>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="mt-4 h-40 w-full rounded-xl" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}

export function UniverseDetailSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-8 py-4', className)} aria-busy="true" aria-hidden>
      <Skeleton className="aspect-[21/9] w-full rounded-2xl" />
      <div className="space-y-3">
        <Skeleton className="h-9 w-2/3 max-w-lg" />
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-4 w-4/5 max-w-xl" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>
      <StoryShelfSkeleton count={4} />
    </div>
  );
}

/** Compact list rows (search results, notification subscriptions). */
export function ListRowsSkeleton({
  count = 5,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn('space-y-3', className)} aria-busy="true" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-border p-3">
          <Skeleton className="h-12 w-12 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Grid of universe/story cards (Universes page). */
export function CardGridSkeleton({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}
      aria-busy="true"
      aria-hidden
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
          <Skeleton className="aspect-[16/10] w-full rounded-none" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Header account slot while auth session resolves (library + alerts placeholders; menu avatar is separate). */
export function HeaderAuthSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-1.5', className)} aria-hidden>
      <Skeleton className="hidden h-9 w-[4.5rem] rounded-md min-[400px]:block sm:w-20" />
      <Skeleton className="h-9 w-9 rounded-md" />
    </div>
  );
}

export function HeaderSheetAuthSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 rounded-lg px-2 py-2', className)} aria-hidden>
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <Skeleton className="h-4 w-28" />
    </div>
  );
}
