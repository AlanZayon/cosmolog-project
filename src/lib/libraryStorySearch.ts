import type { ApiStoryWithProfile } from '@/lib/api/types';

export function filterLibraryStories(
  stories: ApiStoryWithProfile[],
  query: string,
): ApiStoryWithProfile[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return stories;

  return stories.filter((story) => {
    const haystack = [
      story.title,
      story.description ?? '',
      story.profiles?.username ?? '',
      ...(story.tags ?? []),
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalized);
  });
}
