import { apiFetch } from '@/lib/api/client';
import { getProfileByUserId } from '@/lib/api/profiles';
import type {
  ApiConsumeNotificationResponse,
  ApiNotificationListResponse,
  ApiNotificationSubscriptionStatus,
  ApiNotificationUnreadCount,
} from '@/lib/api/types';

export type {
  ApiConsumeNotificationResponse,
  ApiNotificationListItem,
  ApiNotificationListResponse,
  ApiNotificationSubscriptionStatus,
  ApiNotificationUnreadCount,
  NotificationSubscriptionScope,
} from '@/lib/api/types';

export type ListNotificationsParams = {
  limit?: number;
};

export type NotificationSubscriptionTarget = {
  authorId: string;
  universeId?: string;
};

function profileSubscriptionPath(username: string) {
  return `/profiles/${username}/notification-subscription`;
}

function universeSubscriptionPath(universeId: string) {
  return `/universes/${universeId}/notification-subscription`;
}

async function resolveAuthorUsername(authorId: string): Promise<string> {
  const profile = await getProfileByUserId(authorId);
  return profile.username;
}

/** Lists the authenticated user's notifications (newest first). */
export function listNotifications(params: ListNotificationsParams = {}) {
  const search = new URLSearchParams();
  if (params.limit != null) {
    search.set('limit', String(params.limit));
  }
  const query = search.toString();
  const path = query ? `/notifications?${query}` : '/notifications';
  return apiFetch<ApiNotificationListResponse>(path);
}

/** Count of notifications with no read_at (inbox badge). */
export function getUnreadNotificationCount() {
  return apiFetch<ApiNotificationUnreadCount>('/notifications/unread-count');
}

/** Profile subscription status by public username. */
export function getProfileNotificationSubscriptionByUsername(username: string) {
  return apiFetch<ApiNotificationSubscriptionStatus>(
    profileSubscriptionPath(username),
  );
}

/**
 * Subscription status for a profile (by author user id) or universe (when universeId is set).
 */
export async function getNotificationSubscriptionStatus(
  target: NotificationSubscriptionTarget,
): Promise<ApiNotificationSubscriptionStatus> {
  if (target.universeId) {
    return apiFetch<ApiNotificationSubscriptionStatus>(
      universeSubscriptionPath(target.universeId),
    );
  }

  const username = await resolveAuthorUsername(target.authorId);
  return getProfileNotificationSubscriptionByUsername(username);
}

/** Activate or reactivate profile notification subscription by username. */
export function subscribeToProfileByUsername(username: string) {
  return apiFetch<ApiNotificationSubscriptionStatus>(profileSubscriptionPath(username), {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/** Activate or reactivate profile notification subscription for an author. */
export async function subscribeToProfile(authorId: string) {
  const username = await resolveAuthorUsername(authorId);
  return subscribeToProfileByUsername(username);
}

/** Activate or reactivate universe notification subscription. */
export function subscribeToUniverse(universeId: string) {
  return apiFetch<ApiNotificationSubscriptionStatus>(universeSubscriptionPath(universeId), {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/** Deactivate profile notification subscription by username. */
export function cancelProfileSubscriptionByUsername(username: string) {
  return apiFetch<void>(profileSubscriptionPath(username), {
    method: 'DELETE',
  });
}

/** Deactivate profile notification subscription (manual unsubscribe). */
export async function cancelProfileSubscription(authorId: string) {
  const username = await resolveAuthorUsername(authorId);
  return cancelProfileSubscriptionByUsername(username);
}

/** Deactivate universe notification subscription (manual unsubscribe). */
export function cancelUniverseSubscription(universeId: string) {
  return apiFetch<void>(universeSubscriptionPath(universeId), {
    method: 'DELETE',
  });
}

/**
 * Cancels a subscription: universe when universeId is provided, otherwise profile for authorId.
 */
export async function cancelNotificationSubscription(
  target: NotificationSubscriptionTarget,
): Promise<void> {
  if (target.universeId) {
    return cancelUniverseSubscription(target.universeId);
  }
  return cancelProfileSubscription(target.authorId);
}

/** Mark a notification as read/clicked and reset the subscription unconsumed_count. */
export function consumeNotification(notificationId: string) {
  return apiFetch<ApiConsumeNotificationResponse>(
    `/notifications/${notificationId}/consume`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
  );
}
