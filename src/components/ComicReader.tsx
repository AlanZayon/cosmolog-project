"use client";

import { useEffect, useState } from 'react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/useLanguage';
import type { ReadingMode } from '@/components/ReadingModeField';
import { cn } from '@/lib/utils';

const READER_PREF_KEY = 'cosmolog_comic_reading_orientation';

export type ComicPageView = {
  id?: string;
  image_url: string;
  page_order?: number;
};

type Orientation = 'vertical' | 'horizontal';

function readStoredOrientation(): Orientation {
  if (typeof window === 'undefined') return 'vertical';
  try {
    const v = localStorage.getItem(READER_PREF_KEY);
    return v === 'horizontal' ? 'horizontal' : 'vertical';
  } catch {
    return 'vertical';
  }
}

function storeOrientation(value: Orientation) {
  try {
    localStorage.setItem(READER_PREF_KEY, value);
  } catch {
    /* ignore */
  }
}

function resolveInitialOrientation(mode: ReadingMode): Orientation {
  if (mode === 'horizontal') return 'horizontal';
  if (mode === 'vertical') return 'vertical';
  return readStoredOrientation();
}

interface ComicReaderProps {
  pages: ComicPageView[];
  readingMode?: ReadingMode | string | null;
  className?: string;
  pageClassName?: string;
}

export default function ComicReader({
  pages,
  readingMode = 'vertical',
  className,
  pageClassName,
}: ComicReaderProps) {
  const { t } = useLanguage();
  const mode: ReadingMode =
    readingMode === 'horizontal' || readingMode === 'both' || readingMode === 'vertical'
      ? readingMode
      : 'vertical';

  const [orientation, setOrientation] = useState<Orientation>(() =>
    resolveInitialOrientation(mode),
  );
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    setOrientation(resolveInitialOrientation(mode));
  }, [mode]);

  useEffect(() => {
    if (!carouselApi) return;
    const onSelect = () => setCurrent(carouselApi.selectedScrollSnap());
    onSelect();
    carouselApi.on('select', onSelect);
    return () => {
      carouselApi.off('select', onSelect);
    };
  }, [carouselApi]);

  const setReaderOrientation = (next: Orientation) => {
    setOrientation(next);
    if (mode === 'both') storeOrientation(next);
  };

  if (pages.length === 0) return null;

  return (
    <div className={cn('space-y-3', className)}>
      {mode === 'both' && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={orientation === 'vertical' ? 'default' : 'outline'}
            onClick={() => setReaderOrientation('vertical')}
          >
            {t('story.readingModeToggleVertical')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={orientation === 'horizontal' ? 'default' : 'outline'}
            onClick={() => setReaderOrientation('horizontal')}
          >
            {t('story.readingModeToggleHorizontal')}
          </Button>
        </div>
      )}

      {orientation === 'vertical' ? (
        <div className="space-y-4">
          {pages.map((page, i) => (
            <div
              key={page.id || i}
              className={cn('overflow-hidden rounded-lg border border-border', pageClassName)}
            >
              <img
                src={page.image_url}
                alt={`${t('story.page')} ${page.page_order ?? i + 1}`}
                className="w-full object-contain"
                loading="lazy"
              />
              <div className="bg-muted/30 py-1 text-center text-xs text-muted-foreground">
                {t('story.page')} {page.page_order ?? i + 1}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="relative px-10">
          <Carousel setApi={setCarouselApi} opts={{ loop: false }} className="w-full">
            <CarouselContent>
              {pages.map((page, i) => (
                <CarouselItem key={page.id || i}>
                  <div
                    className={cn(
                      'overflow-hidden rounded-lg border border-border',
                      pageClassName,
                    )}
                  >
                    <img
                      src={page.image_url}
                      alt={`${t('story.page')} ${page.page_order ?? i + 1}`}
                      className="mx-auto max-h-[80vh] w-full object-contain"
                      loading="lazy"
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-0" />
            <CarouselNext className="right-0" />
          </Carousel>
          <p className="mt-2 text-center text-xs tabular-nums text-muted-foreground">
            {t('story.page')} {current + 1} / {pages.length}
          </p>
        </div>
      )}
    </div>
  );
}
