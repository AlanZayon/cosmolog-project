'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/useLanguage';
import { cn } from '@/lib/utils';

/**
 * Horizontal shelf: no visible scrollbar, touch pan on small screens,
 * chevron paging on md+ (Netflix-style desktop).
 */
export function HorizontalScrollStrip({
  children,
  className,
  stripClassName,
}: {
  children: ReactNode;
  className?: string;
  stripClassName?: string;
}) {
  const { t } = useLanguage();
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const max = scrollWidth - clientWidth;
    setCanLeft(scrollLeft > 6);
    setCanRight(max > 6 && scrollLeft < max - 6);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [update]);

  const page = (dir: -1 | 1) => {
    const el = ref.current;
    if (!el) return;
    const delta = Math.max(200, Math.floor(el.clientWidth * 0.72));
    el.scrollBy({ left: dir * delta, behavior: 'smooth' });
  };

  const prevLabel = t('common.previous');
  const nextLabel = t('common.next');

  return (
    <div className={cn('relative min-w-0 max-w-full', className)}>
      <div
        ref={ref}
        className={cn(
          'flex min-h-0 min-w-0 max-w-full flex-nowrap gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain pb-3 [-webkit-overflow-scrolling:touch]',
          /* pan-x alone blocks vertical page scroll on mobile when touch starts on the shelf */
          /* proximity + scroll-padding avoids the first/last snap tile looking “cut off” at the shelf edge */
          'snap-x snap-proximity [touch-action:pan-x_pan-y]',
          '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
          stripClassName,
        )}
      >
        {children}
      </div>

      {/* Desktop / tablet: edge arrows only (no scrollbar). Mobile: gesture only. */}
      {canLeft ? (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-[2] hidden w-14 items-center justify-start bg-gradient-to-r from-background via-background/70 to-transparent pl-0.5 md:flex">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="pointer-events-auto h-9 w-9 shrink-0 rounded-full border border-border/80 shadow-md"
            aria-label={prevLabel}
            onClick={() => page(-1)}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </Button>
        </div>
      ) : null}
      {canRight ? (
        <div className="pointer-events-none absolute inset-y-0 right-0 z-[2] hidden w-14 items-center justify-end bg-gradient-to-l from-background via-background/70 to-transparent pr-0.5 md:flex">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="pointer-events-auto h-9 w-9 shrink-0 rounded-full border border-border/80 shadow-md"
            aria-label={nextLabel}
            onClick={() => page(1)}
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
