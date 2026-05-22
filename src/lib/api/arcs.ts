import { apiFetch } from '@/lib/api/client';
import type { ApiArc, ApiStoryWithProfile } from '@/lib/api/types';
import type { ApiUniverse } from '@/lib/api/types';

export type UpsertArcPayload = {
  name: string;
  description?: string | null;
  type: string;
  cover_image_url?: string | null;
};

export function getArc(id: string) {
  return apiFetch<ApiArc>(`/arcs/${id}`);
}

export function getArcStories(id: string) {
  return apiFetch<ApiStoryWithProfile[]>(`/arcs/${id}/stories`);
}

export function createArc(token: string, universeId: string, body: UpsertArcPayload) {
  return apiFetch<ApiArc>(`/universes/${universeId}/arcs`, {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

export function updateArc(token: string, arcId: string, body: UpsertArcPayload) {
  return apiFetch<ApiArc>(`/arcs/${arcId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  });
}

export function deleteArc(token: string, arcId: string) {
  return apiFetch<void>(`/arcs/${arcId}`, { method: 'DELETE', token });
}

export function updateUniverse(
  token: string,
  universeId: string,
  body: { title?: string; description?: string | null; cover_image_url?: string | null },
) {
  return apiFetch<ApiUniverse>(`/universes/${universeId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  });
}
