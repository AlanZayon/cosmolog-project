const CHAPTER_RETURN_STORY_KEY = 'cosmolog:storyChapterReturn:v1';

/** Call when navigating from a story page into one of its chapters (canonical route). */
export function markChapterOpenedFromStory(storyId: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(CHAPTER_RETURN_STORY_KEY, storyId);
  } catch {
    /* private mode / quota */
  }
}

export function peekChapterReturnStoryId(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(CHAPTER_RETURN_STORY_KEY);
}

export function clearChapterReturnStoryId(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(CHAPTER_RETURN_STORY_KEY);
}
