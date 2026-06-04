"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { getActivityNotificationUnreadCount } from '@/lib/api/activityNotifications';
import { useAuth } from '@/hooks/useAuth';

type ActivityNotificationCreatedSseEvent = {
  type: 'activity_notification.created';
  notification_id: string;
  unread_count: number;
};

function parseActivityNotificationSseEvent(
  data: string,
): ActivityNotificationCreatedSseEvent | null {
  try {
    const parsed = JSON.parse(data) as Partial<ActivityNotificationCreatedSseEvent>;
    if (
      parsed.type === 'activity_notification.created' &&
      typeof parsed.notification_id === 'string' &&
      typeof parsed.unread_count === 'number'
    ) {
      return parsed as ActivityNotificationCreatedSseEvent;
    }
  } catch {
    /* ignore malformed payloads */
  }
  return null;
}

type ActivityNotificationInboxContextValue = {
  unreadCount: number;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  refreshUnreadCount: () => Promise<void>;
};

const ActivityNotificationInboxContext = createContext<
  ActivityNotificationInboxContextValue | undefined
>(undefined);

export function ActivityNotificationInboxProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    try {
      const { count } = await getActivityNotificationUnreadCount();
      setUnreadCount(count);
    } catch {
      /* keep previous count */
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    void refreshUnreadCount();
  }, [user, refreshUnreadCount]);

  useEffect(() => {
    if (!user) return;

    const source = new EventSource('/api/proxy/activity-notifications/stream');

    source.onmessage = (message) => {
      const event = parseActivityNotificationSseEvent(message.data);
      if (event) {
        setUnreadCount(event.unread_count);
        window.dispatchEvent(new CustomEvent('cosmolog:activity-notifications-refresh-list'));
      }
    };

    return () => {
      source.close();
    };
  }, [user]);

  return (
    <ActivityNotificationInboxContext.Provider
      value={{ unreadCount, setUnreadCount, refreshUnreadCount }}
    >
      {children}
    </ActivityNotificationInboxContext.Provider>
  );
}

export function useActivityNotificationInbox() {
  const ctx = useContext(ActivityNotificationInboxContext);
  if (!ctx) {
    throw new Error(
      'useActivityNotificationInbox must be used within ActivityNotificationInboxProvider',
    );
  }
  return ctx;
}
