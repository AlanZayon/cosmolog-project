'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import StoryCommentsDrawer from '@/components/comments/StoryCommentsDrawer';

type CommentsDrawerTarget = {
  storyId: string;
  storyTitle?: string;
};

type CommentsDrawerContextValue = {
  openComments: (storyId: string, storyTitle?: string) => void;
  closeComments: () => void;
};

const CommentsDrawerContext = createContext<CommentsDrawerContextValue | null>(null);

export function useCommentsDrawer() {
  const ctx = useContext(CommentsDrawerContext);
  if (!ctx) {
    throw new Error('useCommentsDrawer requires CommentsDrawerProvider');
  }
  return ctx;
}

export function CommentsDrawerProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<CommentsDrawerTarget | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const openComments = useCallback((storyId: string, storyTitle?: string) => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      triggerRef.current = active;
      active.blur();
    } else {
      triggerRef.current = null;
    }
    setTarget({ storyId, storyTitle });
  }, []);

  const closeComments = useCallback(() => {
    setTarget(null);
    const trigger = triggerRef.current;
    triggerRef.current = null;
    if (!trigger?.isConnected) return;
    requestAnimationFrame(() => {
      trigger.focus();
    });
  }, []);

  const value = useMemo(
    () => ({ openComments, closeComments }),
    [openComments, closeComments],
  );

  return (
    <CommentsDrawerContext.Provider value={value}>
      {children}
      {target ? (
        <StoryCommentsDrawer
          storyId={target.storyId}
          storyTitle={target.storyTitle}
          open
          onOpenChange={(open) => {
            if (!open) closeComments();
          }}
        />
      ) : null}
    </CommentsDrawerContext.Provider>
  );
}
