'use client';

import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import StoryFeedPreview from '@/components/feed/StoryFeedPreview';
import DeepExplorePreviewFrame from '@/components/feed/DeepExplorePreviewFrame';
import { useLanguage } from '@/hooks/useLanguage';
import { cn } from '@/lib/utils';

interface StoryFeedReaderProps {
  open: boolean;
  storyId: string;
  onOpenChange: (open: boolean) => void;
}

/** Same deep-preview chrome as the feed stack; opens the canonical route from the footer. */
export default function StoryFeedReader({ open, storyId, onOpenChange }: StoryFeedReaderProps) {
  const { t } = useLanguage();
  const router = useRouter();

  const dismiss = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'gap-0 overflow-hidden rounded-none border-0 bg-transparent !p-0 shadow-none [&>button.absolute]:hidden',
          '!fixed !left-[50%] !top-[50%] !grid !w-[calc(100vw-1rem)] !max-w-none !translate-x-[-50%] !translate-y-[-50%]',
          '!max-h-[min(96dvh,96vh)] sm:!w-full sm:!max-h-[min(92dvh,92vh)] sm:!max-w-3xl lg:!max-w-4xl',
        )}
      >
        <DialogTitle className="sr-only">{t('story.readNow')}</DialogTitle>
        <DeepExplorePreviewFrame
          onBack={dismiss}
          onBackToFeed={dismiss}
          openFullLabel={t('feed.readFullExperience')}
          onOpenFull={() => router.push(`/story/${storyId}`)}
        >
          <StoryFeedPreview storyId={storyId} enabled={open} mode="peek" fullPageMode="action" titleAs="h2" />
        </DeepExplorePreviewFrame>
      </DialogContent>
    </Dialog>
  );
}
