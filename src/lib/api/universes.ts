import { apiFetch } from '@/lib/api/client';
import type { ApiArc, ApiUniverse } from '@/lib/api/types';

export function getMyUniverses() {
  return apiFetch<ApiUniverse[]>('/universes/me');
}

export function getUniverseById(id: string) {
  return apiFetch<ApiUniverse>(`/universes/${id}`);
}

export function getUniverseArcs(universeId: string) {
  return apiFetch<ApiArc[]>(`/universes/${universeId}/arcs`);
}

export type CreateUniversePayload = {
  title: string;
  description?: string | null;
  cover_image_url?: string | null;
};

export function createUniverse(body: CreateUniversePayload) {
  return apiFetch<ApiUniverse>('/universes', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
