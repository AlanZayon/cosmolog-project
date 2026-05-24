import { fetchFeed } from '@/lib/api/feed';

export type FeedItemType = 'story' | 'arc' | 'universe';

export interface FeedStoryPreview {
  kind: 'text' | 'image';
  text: string | null;
  imageUrl: string | null;
}

export interface FeedStoryPayload {
  id: string;
  title: string;
  description: string | null;
  storyType: string;
  coverImageUrl: string | null;
  author: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
  universe: {
    id: string;
    title: string;
    coverImageUrl: string | null;
  } | null;
  arc: {
    id: string;
    name: string;
    type: string;
  } | null;
  preview: FeedStoryPreview;
  stats: {
    likes: number;
    comments: number;
  };
  createdAt: string;
}

export interface FeedArcPayload {
  id: string;
  name: string;
  description: string | null;
  arcType: string;
  coverImageUrl: string | null;
  storyCount: number;
  universe: {
    id: string;
    title: string;
    coverImageUrl: string | null;
  };
  stories: Array<{
    id: string;
    title: string;
    storyType: string;
    coverImageUrl: string | null;
    author: {
      username: string;
      avatarUrl: string | null;
    };
  }>;
}

export interface FeedUniversePayload {
  id: string;
  title: string;
  tagline: string;
  coverImageUrl: string | null;
  storyCount: number;
  arcCount: number;
}

export type StoryFeedItem = {
  id: string;
  type: 'story';
  rankingScore: number;
  payload: FeedStoryPayload;
};

export type ArcFeedItem = {
  id: string;
  type: 'arc';
  rankingScore: number;
  payload: FeedArcPayload;
};

export type UniverseFeedItem = {
  id: string;
  type: 'universe';
  rankingScore: number;
  payload: FeedUniversePayload;
};

export type FeedItem = StoryFeedItem | ArcFeedItem | UniverseFeedItem;

type RawFeedRow = {
  id: string;
  type: string;
  payload: any;
  ranking_score: number;
};

function normalizeFeed(items: RawFeedRow[]): FeedItem[] {
  return items
    .map((item) => {
      if (item.type === 'story') {
        return {
          id: item.id,
          type: 'story',
          rankingScore: item.ranking_score,
          payload: item.payload as FeedStoryPayload,
        } satisfies StoryFeedItem;
      }

      if (item.type === 'arc') {
        return {
          id: item.id,
          type: 'arc',
          rankingScore: item.ranking_score,
          payload: item.payload as FeedArcPayload,
        } satisfies ArcFeedItem;
      }

      if (item.type === 'universe') {
        return {
          id: item.id,
          type: 'universe',
          rankingScore: item.ranking_score,
          payload: item.payload as FeedUniversePayload,
        } satisfies UniverseFeedItem;
      }

      return null;
    })
    .filter((item): item is FeedItem => item !== null);
}

function enforceStoryPriority(items: FeedItem[]) {
  const result: FeedItem[] = [];
  let consecutiveNonStory = 0;

  for (const item of items) {
    if (item.type !== 'story' && consecutiveNonStory >= 2) continue;
    result.push(item);
    consecutiveNonStory = item.type === 'story' ? 0 : consecutiveNonStory + 1;
  }

  return result;
}

export async function getFeed(limit = 24): Promise<FeedItem[]> {
  const data = await fetchFeed(limit);
  return enforceStoryPriority(normalizeFeed(data as RawFeedRow[]));
}
