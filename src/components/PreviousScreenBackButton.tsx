'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/useLanguage';
import { cn } from '@/lib/utils';

type PreviousScreenBackButtonProps = {
  className?: string;
  /** Used when there is no prior history entry (e.g. opened via direct link). */
  fallbackHref?: string;
};

/** Back arrow: browser history when possible; fallback route otherwise. */
export default function PreviousScreenBackButton({
  className,
  fallbackHref = '/',
}: PreviousScreenBackButtonProps) {
  const router = useRouter();
  const { t } = useLanguage();

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  };

  return (
    <div className={cn('flex justify-start', className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-10 w-10 shrink-0 touch-manipulation text-foreground"
        aria-label={t('feed.backOneLevel')}
        onClick={goBack}
      >
        <ArrowLeft className="h-5 w-5" aria-hidden />
      </Button>
    </div>
  );
}
