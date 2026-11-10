import { apiFetch } from '@/lib/api/client';
import type { ApiArc, ApiStoryWithProfile, ApiUniverse } from '@/lib/api/types';

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

export function createArc(universeId: string, body: UpsertArcPayload) {
  return apiFetch<ApiArc>(`/universes/${universeId}/arcs`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateArc(arcId: string, body: UpsertArcPayload) {
  return apiFetch<ApiArc>(`/arcs/${arcId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteArc(arcId: string) {
  return apiFetch<void>(`/arcs/${arcId}`, { method: 'DELETE' });
}

export function updateUniverse(
  universeId: string,
  body: {
    title?: string;
    description?: string | null;
    cover_image_url?: string | null;
    codex_enabled?: boolean;
    saga_premise?: string | null;
    default_calendar_label?: string | null;
    afterword?: string | null;
  },
) {
  return apiFetch<ApiUniverse>(`/universes/${universeId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}
