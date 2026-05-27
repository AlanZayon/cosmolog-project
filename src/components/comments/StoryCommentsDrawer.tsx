'use client';

import { useRef } from 'react';
import StoryCommentsPanel from '@/components/comments/StoryCommentsPanel';
import { useLanguage } from '@/hooks/useLanguage';
import {
  Drawer,
  DrawerContent,
} from '@/components/ui/drawer';

export type StoryCommentsDrawerProps = {
  storyId: string;
  storyTitle?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function StoryCommentsDrawer({
  storyId,
  storyTitle,
  open,
  onOpenChange,
}: StoryCommentsDrawerProps) {
  const { t } = useLanguage();
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} autoFocus>
      <DrawerContent
        ref={contentRef}
        tabIndex={-1}
        a11yTitle={t('story.comments')}
        a11yDescription={storyTitle ?? t('story.comments')}
        className="mx-auto flex max-h-[min(88dvh,88vh)] w-full max-w-lg flex-col p-0 outline-none"
        onOpenAutoFocus={(event) => {
          const active = document.activeElement;
          if (active instanceof HTMLElement && !contentRef.current?.contains(active)) {
            active.blur();
          }
          const root = contentRef.current;
          if (!root) return;
          event.preventDefault();
          const focusable = root.querySelector<HTMLElement>(
            'textarea, button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
          );
          (focusable ?? root).focus();
        }}
      >
        <StoryCommentsPanel storyId={storyId} storyTitle={storyTitle} />
      </DrawerContent>
    </Drawer>
  );
}
