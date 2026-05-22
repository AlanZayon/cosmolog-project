import { apiFetch } from '@/lib/api/client';
import type { ApiArc, ApiUniverse } from '@/lib/api/types';

export function getMyUniverses(token: string) {
  return apiFetch<ApiUniverse[]>('/universes/me', { token });
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

export function createUniverse(token: string, body: CreateUniversePayload) {
  return apiFetch<ApiUniverse>('/universes', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}
