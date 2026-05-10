'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/useLanguage';
import { cn } from '@/lib/utils';

/** Back arrow: browser history when possible; home as fallback (e.g. direct link). */
export default function PreviousScreenBackButton({ className }: { className?: string }) {
  const router = useRouter();
  const { t } = useLanguage();

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/');
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
