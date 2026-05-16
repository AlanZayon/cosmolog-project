export const FEED_EXPLORATION_KEY = 'cosmolog:feedExploration:v1';
export const FEED_RETURN_KEY = 'cosmolog:feedReturn:v1';

export type StackKind = 'story' | 'arc' | 'universe' | 'chapter';

/** `full` = embedded canonical page inside the exploration shell; default/omit = feed preview reader. */
export type StackSurface = 'preview' | 'full';

export type StackItem = {
  kind: StackKind;
  /** Story, arc, or universe id; for chapters, the story id. */
  id: string;
  surface?: StackSurface;
  chapterNum?: number;
};

export function stackItemMatchesStory(item: StackItem, storyId: string): boolean {
  return (
    (item.kind === 'story' && item.id === storyId) ||
    (item.kind === 'chapter' && item.id === storyId)
  );
}

export type FeedSnapshot = {
  scrollY: number;
  expandedArcId: string | null;
};

export type FeedExplorationPersisted = {
  v: 1;
  stack: StackItem[];
  feedSnapshot: FeedSnapshot;
};

export type FeedReturnPayload = {
  v: 1;
  scrollY: number;
  expandedArcId: string | null;
};

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function readExploration(): FeedExplorationPersisted | null {
  if (typeof window === 'undefined') return null;
  const data = safeParse<FeedExplorationPersisted>(sessionStorage.getItem(FEED_EXPLORATION_KEY));
  if (!data || data.v !== 1) return null;
  return data;
}

export function writeExploration(state: FeedExplorationPersisted): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(FEED_EXPLORATION_KEY, JSON.stringify(state));
  } catch {
    /* quota or private mode */
  }
}

export function readFeedReturn(): FeedReturnPayload | null {
  if (typeof window === 'undefined') return null;
  const data = safeParse<FeedReturnPayload>(sessionStorage.getItem(FEED_RETURN_KEY));
  if (!data || data.v !== 1) return null;
  return data;
}

export function writeFeedReturn(payload: FeedReturnPayload): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(FEED_RETURN_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function clearFeedReturn(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(FEED_RETURN_KEY);
}

export function consumeFeedReturn(): FeedReturnPayload | null {
  const p = readFeedReturn();
  clearFeedReturn();
  return p;
}

/** Persist scroll + expanded arc so canonical pages or post-navigation home can restore the feed. */
export function persistFeedResume(snapshot: FeedSnapshot): void {
  writeFeedReturn({
    v: 1,
    scrollY: snapshot.scrollY,
    expandedArcId: snapshot.expandedArcId,
  });
}
