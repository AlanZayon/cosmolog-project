'use client';

import Header from '@/components/Header';
import { FeedListSkeleton, PageContentSkeleton, ProfileHeroSkeleton, StoryShelfSkeleton } from '@/components/loading/skeletons';
import { useLanguage } from '@/hooks/useLanguage';

type Variant = 'generic' | 'feed' | 'profile' | 'library' | 'search';

export default function RouteLoadingFallback({ variant = 'generic' }: { variant?: Variant }) {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container max-w-6xl py-8">
        <span className="sr-only">{t('common.loading')}</span>
        {variant === 'feed' ? (
          <div className="mx-auto max-w-4xl">
            <FeedListSkeleton />
          </div>
        ) : variant === 'profile' ? (
          <>
            <ProfileHeroSkeleton />
            <StoryShelfSkeleton />
            <StoryShelfSkeleton />
          </>
        ) : variant === 'library' || variant === 'search' ? (
          <>
            <PageContentSkeleton rows={2} className="py-0" />
            <StoryShelfSkeleton />
          </>
        ) : (
          <PageContentSkeleton />
        )}
      </main>
    </div>
  );
}
