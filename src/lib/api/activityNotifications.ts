import { apiFetch } from '@/lib/api/client';
import type {
  ApiActivityNotificationListResponse,
  ApiActivityNotificationUnreadCount,
  ApiMarkActivityNotificationReadResponse,
  ApiMarkAllActivityNotificationsReadResponse,
} from '@/lib/api/types';

export type { ApiActivityNotificationListItem } from '@/lib/api/types';

export type ListActivityNotificationsParams = {
  limit?: number;
};

export function listActivityNotifications(params: ListActivityNotificationsParams = {}) {
  const search = new URLSearchParams();
  if (params.limit != null) {
    search.set('limit', String(params.limit));
  }
  const query = search.toString();
  const path = query ? `/activity-notifications?${query}` : '/activity-notifications';
  return apiFetch<ApiActivityNotificationListResponse>(path);
}

export function getActivityNotificationUnreadCount() {
  return apiFetch<ApiActivityNotificationUnreadCount>('/activity-notifications/unread-count');
}

export function markActivityNotificationRead(notificationId: string) {
  return apiFetch<ApiMarkActivityNotificationReadResponse>(
    `/activity-notifications/${notificationId}/read`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
  );
}

export function markAllActivityNotificationsRead() {
  return apiFetch<ApiMarkAllActivityNotificationsReadResponse>(
    '/activity-notifications/read-all',
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
  );
}
