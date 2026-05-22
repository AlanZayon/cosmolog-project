import { apiFetch } from '@/lib/api/client';
import type { ApiStory, ApiStoryWithProfile } from '@/lib/api/types';

export function getMyStories(token: string) {
  return apiFetch<ApiStory[]>('/stories/me', { token });
}

export function getStoryById(id: string) {
  return apiFetch<ApiStory>(`/stories/${id}`);
}

export function searchStories(query: string) {
  const q = encodeURIComponent(query.trim());
  return apiFetch<ApiStoryWithProfile[]>(`/stories/search?q=${q}`);
}

export function getUniverseStories(universeId: string, type?: string | null) {
  const params = type ? `?type=${encodeURIComponent(type)}` : '';
  return apiFetch<ApiStoryWithProfile[]>(`/universes/${universeId}/stories${params}`);
}

export type CreateStoryPayload = {
  title: string;
  description?: string | null;
  tags?: string[];
  type: string;
  universe_id?: string | null;
  arc_id?: string | null;
  cover_image_url?: string | null;
  content?: string | null;
};

export function createStory(token: string, body: CreateStoryPayload) {
  return apiFetch<ApiStory>('/stories', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}
