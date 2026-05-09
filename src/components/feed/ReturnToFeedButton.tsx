'use client';

import { useRouter } from 'next/navigation';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { readExploration, persistFeedResume } from '@/lib/feedExplorationStorage';
import { useLanguage } from '@/hooks/useLanguage';

export default function ReturnToFeedButton() {
  const router = useRouter();
  const { t } = useLanguage();

  const go = () => {
    const snap = readExploration()?.feedSnapshot ?? { scrollY: 0, expandedArcId: null };
    persistFeedResume(snap);
    router.push('/');
  };

  return (
    <Button type="button" variant="outline" size="sm" className="gap-2 touch-manipulation" onClick={go}>
      <Compass className="h-4 w-4 shrink-0" aria-hidden />
      {t('feed.backToFeed')}
    </Button>
  );
}
