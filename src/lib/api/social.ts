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

export function createComment(token: string, storyId: string, content: string) {
  return apiFetch<ApiComment>(`/stories/${storyId}/comments`, {
    method: 'POST',
    token,
    body: JSON.stringify({ content }),
  });
}

export function getLikeStatus(token: string, storyId: string) {
  return apiFetch<{ liked: boolean }>(`/stories/${storyId}/like`, { token });
}

export function toggleLike(token: string, storyId: string) {
  return apiFetch<{ liked: boolean }>(`/stories/${storyId}/like`, {
    method: 'POST',
    token,
  });
}

export function getFollowStatus(token: string, universeId: string) {
  return apiFetch<{ following: boolean }>(`/universes/${universeId}/follow`, { token });
}

export function followUniverse(token: string, universeId: string) {
  return apiFetch<void>(`/universes/${universeId}/follow`, {
    method: 'POST',
    token,
  });
}

export function unfollowUniverse(token: string, universeId: string) {
  return apiFetch<void>(`/universes/${universeId}/follow`, {
    method: 'DELETE',
    token,
  });
}
