/** Stable React Query keys for high-traffic screens (feed, story, profile, library). */
export const queryKeys = {
  feed: {
    all: ['feed'] as const,
  },
  story: {
    detail: (id: string) => ['story', id] as const,
  },
  profile: {
    me: ['profile', 'me'] as const,
    myStories: ['profile', 'me', 'stories'] as const,
    myUniverses: ['profile', 'me', 'universes'] as const,
    byUsername: (username: string) => ['profile', 'username', username] as const,
    storiesByUsername: (username: string) =>
      ['profile', 'username', username, 'stories'] as const,
    universesByUsername: (username: string) =>
      ['profile', 'username', username, 'universes'] as const,
  },
  library: {
    liked: ['library', 'liked'] as const,
    collections: ['library', 'collections'] as const,
  },
} as const;
