import { apiFetch } from '@/lib/api/client';
import type { ApiProfile, ApiStoryWithProfile, ApiUniverse } from '@/lib/api/types';

export type UpdateProfilePayload = {
  username?: string;
  bio?: string;
  avatar_url?: string | null;
};

export function getMyProfile() {
  return apiFetch<ApiProfile>('/profiles/me');
}

export function patchMyProfile(body: UpdateProfilePayload) {
  return apiFetch<ApiProfile>('/profiles/me', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/** Username path segment — the BFF proxy encodes segments; do not encodeURIComponent here. */
function profileUsernamePath(username: string, suffix = '') {
  return `/profiles/${username}${suffix}`;
}

export function getProfileByUsername(username: string) {
  return apiFetch<ApiProfile>(profileUsernamePath(username));
}

export function getProfileStoriesByUsername(username: string) {
  return apiFetch<ApiStoryWithProfile[]>(profileUsernamePath(username, '/stories'));
}

export function getProfileUniversesByUsername(username: string) {
  return apiFetch<ApiUniverse[]>(profileUsernamePath(username, '/universes'));
}

export function getProfileByUserId(userId: string) {
  return apiFetch<ApiProfile>(`/profiles/user/${userId}`);
}

export function searchProfiles(query: string) {
  const q = encodeURIComponent(query.trim());
  return apiFetch<ApiProfile[]>(`/profiles/search?q=${q}`);
}

export function getProfilesBatch(ids: string[]) {
  if (ids.length === 0) return Promise.resolve([] as ApiProfile[]);
  return apiFetch<ApiProfile[]>(`/profiles/batch?ids=${ids.join(',')}`);
}
