import { apiFetch } from '@/lib/api/client';

type RawFeedRow = {
  id: string;
  type: string;
  payload: unknown;
  ranking_score: number;
};

export function fetchFeed(token?: string, limit = 24) {
  const q = limit !== 24 ? `?limit=${limit}` : '';
  return apiFetch<RawFeedRow[]>(`/feed${q}`, { token });
}
