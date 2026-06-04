import { apiFetch } from '@/lib/api/client';
import type { ApiStoryWithProfile } from '@/lib/api/types';

export type CollectionVisibility = 'public' | 'private';
export type CollectionOwnership = 'owned' | 'saved' | 'public';

export type ApiLibraryCollection = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  icon: string;
  visibility: CollectionVisibility;
  created_at: string;
  updated_at: string;
};

export type ApiLibraryCollectionSummary = ApiLibraryCollection & {
  item_count: number;
  ownership: CollectionOwnership;
  owner_username: string | null;
  saved_at: string | null;
  is_saved_by_me: boolean;
};

export type ApiLibraryStoryItem = ApiStoryWithProfile & {
  library_added_at?: string | null;
  liked_at?: string | null;
  universe_title?: string | null;
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

export type ApiLibraryCollectionSaveStatus = {
  saved: boolean;
};

export function getLikedStories() {
  return apiFetch<ApiLibraryStoryItem[]>('/library/liked-stories');
}

export function getLibraryCollections() {
  return apiFetch<ApiLibraryCollectionSummary[]>('/library/collections');
}

export function getLibraryCollection(id: string) {
  return apiFetch<ApiLibraryCollectionSummary>(`/library/collections/${id}`);
}

export function searchLibraryCollections(q: string) {
  const params = new URLSearchParams({ q });
  return apiFetch<ApiLibraryCollectionSummary[]>(
    `/library/collections/search?${params.toString()}`,
  );
}

export function createLibraryCollection(body: {
  name: string;
  description?: string | null;
  icon?: string | null;
  visibility?: CollectionVisibility;
}) {
  return apiFetch<ApiLibraryCollection>('/library/collections', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateLibraryCollection(
  id: string,
  body: {
    name?: string;
    description?: string | null;
    icon?: string | null;
    visibility?: CollectionVisibility;
  },
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
  return apiFetch<ApiLibraryStoryItem[]>(`/library/collections/${collectionId}/stories`);
}

export function saveLibraryCollection(id: string) {
  return apiFetch<void>(`/library/collections/${id}/save`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function unsaveLibraryCollection(id: string) {
  return apiFetch<void>(`/library/collections/${id}/save`, {
    method: 'DELETE',
  });
}

export function getCollectionSaveStatus(id: string) {
  return apiFetch<ApiLibraryCollectionSaveStatus>(
    `/library/collections/${id}/save-status`,
  );
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
