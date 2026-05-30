import { apiFetch } from '@/lib/api/client';
import type { ApiStoryWithProfile } from '@/lib/api/types';

export type ApiLibraryCollection = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  icon: string;
  visibility: string;
  created_at: string;
  updated_at: string;
};

export type ApiLibraryCollectionSummary = ApiLibraryCollection & {
  item_count: number;
};

export type ApiLibraryStatusCollection = {
  id: string;
  name: string;
  icon: string;
  description: string | null;
  contains_story: boolean;
};

export type ApiLibraryStatus = {
  liked: boolean;
  collections: ApiLibraryStatusCollection[];
};

export function getLikedStories() {
  return apiFetch<ApiStoryWithProfile[]>('/library/liked-stories');
}

export function getLibraryCollections() {
  return apiFetch<ApiLibraryCollectionSummary[]>('/library/collections');
}

export function createLibraryCollection(body: {
  name: string;
  description?: string | null;
  icon?: string | null;
}) {
  return apiFetch<ApiLibraryCollection>('/library/collections', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateLibraryCollection(
  id: string,
  body: { name?: string; description?: string | null; icon?: string | null },
) {
  return apiFetch<ApiLibraryCollection>(`/library/collections/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteLibraryCollection(id: string) {
  return apiFetch<void>(`/library/collections/${id}`, {
    method: 'DELETE',
  });
}

export function getCollectionStories(collectionId: string) {
  return apiFetch<ApiStoryWithProfile[]>(`/library/collections/${collectionId}/stories`);
}

export function addStoryToCollection(collectionId: string, storyId: string) {
  return apiFetch<void>(`/library/collections/${collectionId}/stories/${storyId}`, {
    method: 'POST',
  });
}

export function removeStoryFromCollection(collectionId: string, storyId: string) {
  return apiFetch<void>(`/library/collections/${collectionId}/stories/${storyId}`, {
    method: 'DELETE',
  });
}

export function reorderCollectionStories(collectionId: string, storyIds: string[]) {
  return apiFetch<void>(`/library/collections/${collectionId}/stories/order`, {
    method: 'PUT',
    body: JSON.stringify({ story_ids: storyIds }),
  });
}

export function getStoryLibraryStatus(storyId: string) {
  return apiFetch<ApiLibraryStatus>(`/stories/${storyId}/library-status`);
}
