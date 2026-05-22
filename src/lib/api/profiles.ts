import { apiFetch } from '@/lib/api/client';
import type { ApiProfile } from '@/lib/api/types';

export type UpdateProfilePayload = {
  username?: string;
  bio?: string;
  avatar_url?: string | null;
};

export function getMyProfile(token: string) {
  return apiFetch<ApiProfile>('/profiles/me', { token });
}

export function patchMyProfile(token: string, body: UpdateProfilePayload) {
  return apiFetch<ApiProfile>('/profiles/me', {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  });
}

export function getProfileByUsername(username: string) {
  return apiFetch<ApiProfile>(`/profiles/${encodeURIComponent(username)}`);
}

export function getProfileByUserId(userId: string) {
  return apiFetch<ApiProfile>(`/profiles/user/${userId}`);
}

export function getProfilesBatch(ids: string[]) {
  if (ids.length === 0) return Promise.resolve([] as ApiProfile[]);
  return apiFetch<ApiProfile[]>(`/profiles/batch?ids=${ids.join(',')}`);
}
