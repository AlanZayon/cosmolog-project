import type { ApiLibraryStoryItem } from '@/lib/api/library';

export function filterLibraryStories(
  stories: ApiLibraryStoryItem[],
  query: string,
): ApiLibraryStoryItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return stories;

  return stories.filter((story) => {
    const haystack = [
      story.title,
      story.description ?? '',
      story.profiles?.username ?? '',
      story.universe_title ?? '',
      ...(story.tags ?? []),
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalized);
  });
}
