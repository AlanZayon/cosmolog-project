import { apiFetch } from '@/lib/api/client';

export function fetchFeed(limit = 24) {
  const q = limit !== 24 ? `?limit=${limit}` : '';
  return apiFetch<unknown[]>(`/feed${q}`);
}
