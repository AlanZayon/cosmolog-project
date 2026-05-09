import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import StoryFeedPreview from '@/components/feed/StoryFeedPreview';
import { useLanguage } from '@/hooks/useLanguage';

interface StoryFeedReaderProps {
  open: boolean;
  storyId: string;
  onOpenChange: (open: boolean) => void;
}

export default function StoryFeedReader({ open, storyId, onOpenChange }: StoryFeedReaderProps) {
  const { t } = useLanguage();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!left-0 !top-0 !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 overflow-y-auto rounded-none border-0 p-0">
        <DialogTitle className="sr-only">{t('story.readNow')}</DialogTitle>
        <StoryFeedPreview storyId={storyId} enabled={open} fullPageMode="link" titleAs="h1" />
      </DialogContent>
    </Dialog>
  );
}
