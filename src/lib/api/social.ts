import { apiFetch } from '@/lib/api/client';

export type ApiComment = {
  id: string;
  story_id: string;
  user_id: string;
  content: string;
  created_at: string;
  username: string | null;
};

export function getStoryComments(storyId: string) {
  return apiFetch<ApiComment[]>(`/stories/${storyId}/comments`);
}

export function createComment(storyId: string, content: string) {
  return apiFetch<ApiComment>(`/stories/${storyId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export function getLikeStatus(storyId: string) {
  return apiFetch<{ liked: boolean }>(`/stories/${storyId}/like`);
}

export function toggleLike(storyId: string) {
  return apiFetch<{ liked: boolean }>(`/stories/${storyId}/like`, {
    method: 'POST',
  });
}

export function getFollowStatus(universeId: string) {
  return apiFetch<{ following: boolean }>(`/universes/${universeId}/follow`);
}

export function followUniverse(universeId: string) {
  return apiFetch<void>(`/universes/${universeId}/follow`, {
    method: 'POST',
  });
}

export function unfollowUniverse(universeId: string) {
  return apiFetch<void>(`/universes/${universeId}/follow`, {
    method: 'DELETE',
  });
}
