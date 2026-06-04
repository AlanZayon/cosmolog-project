import type { ApiNotificationSubscriptionListItem } from '@/lib/api/types';

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function filterProfileAlerts(
  items: ApiNotificationSubscriptionListItem[],
  query: string,
): ApiNotificationSubscriptionListItem[] {
  const normalized = normalizeQuery(query);
  if (!normalized) return items;

  return items.filter((item) => item.target_username.toLowerCase().includes(normalized));
}

export function filterUniverseAlerts(
  items: ApiNotificationSubscriptionListItem[],
  query: string,
): ApiNotificationSubscriptionListItem[] {
  const normalized = normalizeQuery(query);
  if (!normalized) return items;

  return items.filter((item) => {
    const haystack = [item.universe_title ?? '', item.target_username].join(' ').toLowerCase();
    return haystack.includes(normalized);
  });
}
