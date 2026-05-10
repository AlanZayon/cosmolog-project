'use client';

import type { ReactNode } from 'react';
import { ArrowLeft, Compass, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/useLanguage';

export interface DeepExplorePreviewFrameProps {
  children: ReactNode;
  onBack: () => void;
  onBackToFeed: () => void;
  openFullLabel: string;
  onOpenFull: () => void;
  /** Hide “open full” when not applicable */
  showOpenFull?: boolean;
}

export default function DeepExplorePreviewFrame({
  children,
  onBack,
  onBackToFeed,
  openFullLabel,
  onOpenFull,
  showOpenFull = true,
}: DeepExplorePreviewFrameProps) {
  const { t } = useLanguage();

  return (
    <div className="flex h-full max-h-[min(100dvh,100vh)] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-[0_24px_60px_-12px_rgba(0,0,0,0.35)] sm:max-h-[min(92dvh,92vh)] sm:rounded-2xl">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">{children}</div>

      <footer className="shrink-0 border-t border-border bg-card/95 px-2 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/90 sm:px-4">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2 sm:justify-between">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="touch-manipulation gap-1.5 max-sm:px-2"
              aria-label={t('feed.backOneLevel')}
              onClick={onBack}
            >
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
              <span className="max-sm:sr-only">{t('feed.backOneLevel')}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="touch-manipulation gap-1.5 max-sm:px-2"
              aria-label={t('feed.backToFeed')}
              onClick={onBackToFeed}
            >
              <Compass className="h-4 w-4 shrink-0" aria-hidden />
              <span className="max-sm:sr-only">{t('feed.backToFeed')}</span>
            </Button>
          </div>
          {showOpenFull ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="touch-manipulation gap-1.5 border-primary/25 max-sm:px-2 sm:ml-auto"
              aria-label={openFullLabel}
              onClick={onOpenFull}
            >
              <ExternalLink className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              <span className="max-sm:sr-only">{openFullLabel}</span>
            </Button>
          ) : null}
        </div>
      </footer>
    </div>
  );
}
