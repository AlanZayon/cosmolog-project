import type { ApiLibraryStoryItem } from '@/lib/api/library';

export type StorySortOrder = 'recent' | 'oldest';
export type UniverseFilterValue = 'all' | 'none' | string;

export type StoryListFilters = {
  sort: StorySortOrder;
  tag: string;
  author: string;
  universe: UniverseFilterValue;
};

export const DEFAULT_STORY_LIST_FILTERS: StoryListFilters = {
  sort: 'recent',
  tag: 'all',
  author: 'all',
  universe: 'all',
};

export function storySortTimestamp(story: ApiLibraryStoryItem): string {
  return story.library_added_at ?? story.liked_at ?? story.created_at;
}

export function collectStoryFilterOptions(stories: ApiLibraryStoryItem[]) {
  const tags = new Set<string>();
  const authors = new Set<string>();
  const universes = new Map<string, string>();

  for (const story of stories) {
    for (const tag of story.tags ?? []) {
      if (tag.trim()) tags.add(tag);
    }
    const username = story.profiles?.username;
    if (username) authors.add(username);
    if (story.universe_id) {
      universes.set(
        story.universe_id,
        story.universe_title ?? story.universe_id,
      );
    }
  }

  return {
    tags: [...tags].sort((a, b) => a.localeCompare(b)),
    authors: [...authors].sort((a, b) => a.localeCompare(b)),
    universes: [...universes.entries()]
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title)),
  };
}

export function filterAndSortLibraryStories(
  stories: ApiLibraryStoryItem[],
  filters: StoryListFilters,
): ApiLibraryStoryItem[] {
  let result = stories;

  if (filters.tag !== 'all') {
    result = result.filter((s) => (s.tags ?? []).includes(filters.tag));
  }

  if (filters.author !== 'all') {
    result = result.filter((s) => s.profiles?.username === filters.author);
  }

  if (filters.universe === 'none') {
    result = result.filter((s) => !s.universe_id);
  } else if (filters.universe !== 'all') {
    result = result.filter((s) => s.universe_id === filters.universe);
  }

  return [...result].sort((a, b) => {
    const ta = new Date(storySortTimestamp(a)).getTime();
    const tb = new Date(storySortTimestamp(b)).getTime();
    return filters.sort === 'recent' ? tb - ta : ta - tb;
  });
}
