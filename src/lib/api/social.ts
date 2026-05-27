import { apiFetch } from '@/lib/api/client';
import type { ApiComment } from '@/lib/api/types';

export type { ApiComment };

export function getStoryComments(storyId: string) {
  return apiFetch<ApiComment[]>(`/stories/${storyId}/comments`);
}

export function createComment(storyId: string, content: string, parentId?: string | null) {
  return apiFetch<ApiComment>(`/stories/${storyId}/comments`, {
    method: 'POST',
    body: JSON.stringify({
      content,
      parent_id: parentId ?? null,
    }),
  });
}

export function toggleCommentLike(storyId: string, commentId: string) {
  return apiFetch<{ liked: boolean }>(`/stories/${storyId}/comments/${commentId}/like`, {
    method: 'POST',
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
