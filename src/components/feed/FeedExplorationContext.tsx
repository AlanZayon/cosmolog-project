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
import { usePathname } from 'next/navigation';
import { ArrowLeft, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StoryFeedPreview from '@/components/feed/StoryFeedPreview';
import ArcFeedReader from '@/components/feed/ArcFeedReader';
import UniverseFeedReader from '@/components/feed/UniverseFeedReader';
import ExplorationFullSurface from '@/components/feed/ExplorationFullSurface';
import DeepExplorePreviewFrame from '@/components/feed/DeepExplorePreviewFrame';
import {
  consumeFeedReturn,
  readExploration,
  writeExploration,
  type FeedSnapshot,
  type StackItem,
  type StackKind,
} from '@/lib/feedExplorationStorage';
import { useLanguage } from '@/hooks/useLanguage';

type FeedExplorationValue = {
  stack: StackItem[];
  expandedArcId: string | null;
  setExpandedArcId: (id: string | null) => void;
  pushStory: (id: string) => void;
  openStoryComments: (id: string) => void;
  pushArc: (id: string) => void;
  pushUniverse: (id: string) => void;
  pop: () => void;
  popToFeed: () => void;
  getFeedSnapshot: () => FeedSnapshot;
  /** Push embedded canonical view on top of the stack (preview stays underneath so back returns to preview). */
  promoteToFullSurface: (kind: Exclude<StackKind, 'chapter'>, id: string) => void;
  pushChapter: (storyId: string, chapterNum: number) => void;
  navigateChapter: (storyId: string, chapterNum: number) => void;
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
    promoteToFullSurface,
    pushChapter,
    navigateChapter,
  } = useFeedExploration();

  const top = stack.length > 0 ? stack[stack.length - 1] : undefined;
  const open = pathname === '/' && top != null;
  const surface = top?.surface ?? 'preview';
  /** First card from feed = one preview item; deeper exploration adds more stack entries. */
  const showBackToFeedChrome = stack.length > 1;

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

  if (!open || top == null) return null;

  if (surface === 'preview') {
    const openFullLabel =
      top.kind === 'story'
        ? t('feed.readFullExperience')
        : top.kind === 'arc'
          ? t('feed.openFullArc')
          : t('feed.openFullUniverse');

    return (
      <div
        className="fixed inset-0 z-[100] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label={t('feed.explorationLayer')}
      >
        <button
          type="button"
          className="absolute inset-0 z-0 cursor-default border-0 bg-black/35 p-0 dark:bg-black/50 supports-[backdrop-filter]:backdrop-blur-md [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none"
          aria-label={t('feed.backOneLevel')}
          onClick={() => pop()}
        />

        <div className="pointer-events-none relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center p-2 sm:p-6">
          <div
            className="pointer-events-auto flex min-h-0 max-h-[min(96dvh,96vh)] w-full max-w-4xl flex-col sm:max-h-[min(92dvh,92vh)] sm:max-w-3xl lg:max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <DeepExplorePreviewFrame
              onBack={() => pop()}
              onBackToFeed={() => popToFeed()}
              openFullLabel={openFullLabel}
              onOpenFull={() => {
                if (top.kind === 'chapter') return;
                promoteToFullSurface(top.kind, top.id);
              }}
              showBackToFeedButton={showBackToFeedChrome}
            >
              {top.kind === 'story' && (
                <StoryFeedPreview
                  storyId={top.id}
                  enabled
                  mode="peek"
                  fullPageMode="action"
                  onOpenFullPage={() => promoteToFullSurface('story', top.id)}
                  onNavigateArc={pushArc}
                  onNavigateUniverse={pushUniverse}
                  titleAs="h2"
                />
              )}
              {top.kind === 'arc' && (
                <ArcFeedReader
                  arcId={top.id}
                  enabled
                  peekLayer
                  onOpenStory={pushStory}
                  onOpenUniverse={pushUniverse}
                  onOpenFullArc={() => promoteToFullSurface('arc', top.id)}
                />
              )}
              {top.kind === 'universe' && (
                <UniverseFeedReader
                  universeId={top.id}
                  enabled
                  peekLayer
                  onOpenArc={pushArc}
                  onOpenStory={pushStory}
                  onOpenFullUniverse={() => promoteToFullSurface('universe', top.id)}
                />
              )}
            </DeepExplorePreviewFrame>
          </div>
        </div>
      </div>
    );
  }

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
        {showBackToFeedChrome ? (
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
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <ExplorationFullSurface
          item={top}
          pushStory={pushStory}
          pushArc={pushArc}
          pushUniverse={pushUniverse}
          pushChapter={pushChapter}
          navigateChapter={navigateChapter}
        />
      </div>
    </div>
  );
}

export function FeedExplorationProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [stack, setStack] = useState<StackItem[]>([]);
  const [expandedArcId, setExpandedArcIdState] = useState<string | null>(null);
  const explorationHydratedRef = useRef(false);

  const expandedArcIdRef = useRef<string | null>(null);
  const stackRef = useRef<StackItem[]>([]);
  const feedSnapshotRef = useRef<FeedSnapshot>({ scrollY: 0, expandedArcId: null });

  useLayoutEffect(() => {
    expandedArcIdRef.current = expandedArcId;
  }, [expandedArcId]);

  useLayoutEffect(() => {
    stackRef.current = stack;
  }, [stack]);

  useLayoutEffect(() => {
    if (explorationHydratedRef.current) return;
    explorationHydratedRef.current = true;
    const persisted = readExploration();
    if (!persisted?.stack.length) return;
    feedSnapshotRef.current = persisted.feedSnapshot;
    setExpandedArcIdState(persisted.feedSnapshot.expandedArcId);
    setStack(persisted.stack);
  }, []);
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
  const openStoryComments = useCallback(
    (id: string) => pushItem({ kind: 'story', id, surface: 'full', focusComments: true }),
    [pushItem],
  );
  const pushArc = useCallback((id: string) => pushItem({ kind: 'arc', id }), [pushItem]);
  const pushUniverse = useCallback((id: string) => pushItem({ kind: 'universe', id }), [pushItem]);

  const pushChapter = useCallback(
    (storyId: string, chapterNum: number) => {
      pushItem({ kind: 'chapter', id: storyId, chapterNum, surface: 'full' });
    },
    [pushItem],
  );

  const navigateChapter = useCallback(
    (storyId: string, chapterNum: number) => {
      setStack((prev) => {
        const top = prev[prev.length - 1];
        const next =
          top?.kind === 'chapter' && top.id === storyId
            ? [...prev.slice(0, -1), { kind: 'chapter' as const, id: storyId, chapterNum, surface: 'full' as const }]
            : [...prev, { kind: 'chapter' as const, id: storyId, chapterNum, surface: 'full' as const }];
        queueMicrotask(() => syncStorage(next, feedSnapshotRef.current));
        return next;
      });
    },
    [syncStorage],
  );

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

  const promoteToFullSurface = useCallback(
    (kind: Exclude<StackKind, 'chapter'>, entityId: string) => {
      setStack((prev) => {
        const top = prev[prev.length - 1];
        const topSurface = top?.surface ?? 'preview';
        if (top && top.kind === kind && top.id === entityId && topSurface === 'full') {
          return prev;
        }
        // Keep preview entry below so shell `pop()` returns to preview instead of closing the stack to the feed.
        const next = [...prev, { kind, id: entityId, surface: 'full' as const }];
        syncStorage(next, feedSnapshotRef.current);
        return next;
      });
    },
    [syncStorage],
  );

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
      openStoryComments,
      pushArc,
      pushUniverse,
      pop,
      popToFeed,
      getFeedSnapshot,
      promoteToFullSurface,
      pushChapter,
      navigateChapter,
    }),
    [
      stack,
      expandedArcId,
      setExpandedArcId,
      pushStory,
      openStoryComments,
      pushArc,
      pushUniverse,
      pop,
      popToFeed,
      getFeedSnapshot,
      promoteToFullSurface,
      pushChapter,
      navigateChapter,
    ],
  );

  return (
    <FeedExplorationContext.Provider value={value}>
      {children}
      <FeedExplorationStackShell />
    </FeedExplorationContext.Provider>
  );
}
