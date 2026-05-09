'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StoryFeedPreview from '@/components/feed/StoryFeedPreview';
import ArcFeedReader from '@/components/feed/ArcFeedReader';
import UniverseFeedReader from '@/components/feed/UniverseFeedReader';
import {
  consumeFeedReturn,
  persistFeedResume,
  writeExploration,
  type FeedSnapshot,
  type StackItem,
} from '@/lib/feedExplorationStorage';
import { useLanguage } from '@/hooks/useLanguage';

type FeedExplorationValue = {
  stack: StackItem[];
  expandedArcId: string | null;
  setExpandedArcId: (id: string | null) => void;
  pushStory: (id: string) => void;
  pushArc: (id: string) => void;
  pushUniverse: (id: string) => void;
  pop: () => void;
  popToFeed: () => void;
  getFeedSnapshot: () => FeedSnapshot;
  navigateToFullStory: (storyId: string) => void;
  navigateToFullArc: (arcId: string) => void;
  navigateToFullUniverse: (universeId: string) => void;
};

const FeedExplorationContext = createContext<FeedExplorationValue | null>(null);

export function useFeedExploration() {
  const ctx = useContext(FeedExplorationContext);
  if (!ctx) throw new Error('useFeedExploration requires FeedExplorationProvider');
  return ctx;
}

function FeedExplorationStackShell() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const {
    stack,
    pop,
    popToFeed,
    pushStory,
    pushArc,
    pushUniverse,
    navigateToFullStory,
    navigateToFullArc,
    navigateToFullUniverse,
  } = useFeedExploration();

  const open = pathname === '/' && stack.length > 0;
  const top = stack[stack.length - 1];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        pop();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, pop]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !top) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-background"
      role="dialog"
      aria-modal="true"
      aria-label={t('feed.explorationLayer')}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-border bg-background/95 px-2 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 touch-manipulation"
          aria-label={t('feed.backOneLevel')}
          onClick={() => pop()}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto touch-manipulation gap-1.5 sm:gap-2"
          onClick={() => popToFeed()}
        >
          <Compass className="h-4 w-4 shrink-0" aria-hidden />
          <span className="max-sm:sr-only">{t('feed.backToFeed')}</span>
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {top.kind === 'story' && (
          <StoryFeedPreview
            storyId={top.id}
            enabled
            fullPageMode="action"
            onOpenFullPage={() => navigateToFullStory(top.id)}
            onNavigateArc={pushArc}
            onNavigateUniverse={pushUniverse}
            titleAs="h1"
          />
        )}
        {top.kind === 'arc' && (
          <ArcFeedReader
            arcId={top.id}
            enabled
            onOpenStory={pushStory}
            onOpenUniverse={pushUniverse}
            onOpenFullArc={() => navigateToFullArc(top.id)}
          />
        )}
        {top.kind === 'universe' && (
          <UniverseFeedReader
            universeId={top.id}
            enabled
            onOpenArc={pushArc}
            onOpenStory={pushStory}
            onOpenFullUniverse={() => navigateToFullUniverse(top.id)}
          />
        )}
      </div>
    </div>
  );
}

export function FeedExplorationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [stack, setStack] = useState<StackItem[]>([]);
  const [expandedArcId, setExpandedArcIdState] = useState<string | null>(null);

  const expandedArcIdRef = useRef<string | null>(null);
  const stackRef = useRef<StackItem[]>([]);

  useLayoutEffect(() => {
    expandedArcIdRef.current = expandedArcId;
  }, [expandedArcId]);

  useLayoutEffect(() => {
    stackRef.current = stack;
  }, [stack]);

  const feedSnapshotRef = useRef<FeedSnapshot>({ scrollY: 0, expandedArcId: null });
  /** Skips one feed snapshot sync from effects right after closing the stack (scroll restore is async). */
  const skipFeedSnapshotSyncRef = useRef(false);

  const syncStorage = useCallback((nextStack: StackItem[], snap: FeedSnapshot) => {
    feedSnapshotRef.current = snap;
    writeExploration({ v: 1, stack: nextStack, feedSnapshot: snap });
  }, []);

  const getFeedSnapshot = useCallback((): FeedSnapshot => {
    if (typeof window === 'undefined') {
      return { scrollY: 0, expandedArcId: expandedArcIdRef.current };
    }
    return {
      scrollY: window.scrollY,
      expandedArcId: expandedArcIdRef.current,
    };
  }, []);

  const finishRestoreSnap = useCallback((snap: FeedSnapshot) => {
    skipFeedSnapshotSyncRef.current = true;
    feedSnapshotRef.current = snap;
    setExpandedArcIdState(snap.expandedArcId);
    syncStorage([], snap);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: snap.scrollY, behavior: 'instant' });
        skipFeedSnapshotSyncRef.current = false;
      });
    });
  }, [syncStorage]);

  const pushItem = useCallback(
    (item: StackItem) => {
      setStack((prev) => {
        const next = [...prev, item];
        if (prev.length === 0) {
          const snap: FeedSnapshot = {
            scrollY: typeof window !== 'undefined' ? window.scrollY : 0,
            expandedArcId: expandedArcIdRef.current,
          };
          syncStorage(next, snap);
        } else {
          syncStorage(next, feedSnapshotRef.current);
        }
        return next;
      });
    },
    [syncStorage],
  );

  const pushStory = useCallback((id: string) => pushItem({ kind: 'story', id }), [pushItem]);
  const pushArc = useCallback((id: string) => pushItem({ kind: 'arc', id }), [pushItem]);
  const pushUniverse = useCallback((id: string) => pushItem({ kind: 'universe', id }), [pushItem]);

  const pop = useCallback(() => {
    setStack((prev) => {
      if (prev.length === 0) return prev;
      if (prev.length === 1) {
        queueMicrotask(() => finishRestoreSnap(feedSnapshotRef.current));
        return [];
      }
      const next = prev.slice(0, -1);
      queueMicrotask(() => syncStorage(next, feedSnapshotRef.current));
      return next;
    });
  }, [finishRestoreSnap, syncStorage]);

  const popToFeed = useCallback(() => {
    if (stackRef.current.length === 0) return;
    const snap = feedSnapshotRef.current;
    setStack([]);
    finishRestoreSnap(snap);
  }, [finishRestoreSnap]);

  const setExpandedArcId = useCallback((id: string | null) => {
    setExpandedArcIdState(id);
  }, []);

  useEffect(() => {
    if (stack.length > 0) return;
    if (skipFeedSnapshotSyncRef.current) return;
    const snap = getFeedSnapshot();
    syncStorage([], snap);
  }, [expandedArcId, stack.length, getFeedSnapshot, syncStorage]);

  useEffect(() => {
    if (stack.length > 0) return;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (timeoutId != null) return;
      timeoutId = setTimeout(() => {
        timeoutId = null;
        const snap = getFeedSnapshot();
        syncStorage([], snap);
      }, 120);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, [stack.length, getFeedSnapshot, syncStorage]);

  const leaveToCanonical = useCallback(
    (href: string) => {
      const snap = feedSnapshotRef.current;
      persistFeedResume(snap);
      writeExploration({ v: 1, stack: [], feedSnapshot: snap });
      setStack([]);
      router.push(href);
    },
    [router],
  );

  const navigateToFullStory = useCallback((id: string) => leaveToCanonical(`/story/${id}`), [leaveToCanonical]);
  const navigateToFullArc = useCallback((id: string) => leaveToCanonical(`/arc/${id}`), [leaveToCanonical]);
  const navigateToFullUniverse = useCallback((id: string) => leaveToCanonical(`/universe/${id}`), [leaveToCanonical]);

  useLayoutEffect(() => {
    if (pathname !== '/') return;
    const payload = consumeFeedReturn();
    if (!payload) return;
    const snap: FeedSnapshot = {
      scrollY: payload.scrollY,
      expandedArcId: payload.expandedArcId,
    };
    skipFeedSnapshotSyncRef.current = true;
    feedSnapshotRef.current = snap;
    setExpandedArcIdState(snap.expandedArcId);
    writeExploration({ v: 1, stack: [], feedSnapshot: snap });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: snap.scrollY, behavior: 'instant' });
        skipFeedSnapshotSyncRef.current = false;
      });
    });
  }, [pathname]);

  const value = useMemo<FeedExplorationValue>(
    () => ({
      stack,
      expandedArcId,
      setExpandedArcId,
      pushStory,
      pushArc,
      pushUniverse,
      pop,
      popToFeed,
      getFeedSnapshot,
      navigateToFullStory,
      navigateToFullArc,
      navigateToFullUniverse,
    }),
    [
      stack,
      expandedArcId,
      setExpandedArcId,
      pushStory,
      pushArc,
      pushUniverse,
      pop,
      popToFeed,
      getFeedSnapshot,
      navigateToFullStory,
      navigateToFullArc,
      navigateToFullUniverse,
    ],
  );

  return (
    <FeedExplorationContext.Provider value={value}>
      {children}
      <FeedExplorationStackShell />
    </FeedExplorationContext.Provider>
  );
}
