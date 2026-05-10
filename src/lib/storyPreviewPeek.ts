/** Limits for deep preview (“peek”) — keep generous to avoid frustration on short works. */

export const PEEK_SHORT_STORY_MAX_CHARS = 1600;
export const PEEK_CHAPTER_BODY_MAX_CHARS = 2200;
export const PEEK_CHAPTERS_SHOWN = 1;
export const PEEK_COMIC_PAGES = 3;
export const PEEK_ILLUSTRATED_BLOCKS = 6;

export function truncateText(text: string, maxChars: number): { text: string; truncated: boolean } {
  const t = text.trim();
  if (t.length <= maxChars) return { text: t, truncated: false };
  const slice = t.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > maxChars * 0.65 ? slice.slice(0, lastSpace) : slice;
  return { text: `${cut.trim()}…`, truncated: true };
}
