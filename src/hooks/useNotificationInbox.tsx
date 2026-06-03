"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { getUnreadNotificationCount } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

type NotificationCreatedSseEvent = {
  type: 'notification.created';
  notification_id: string;
  unread_count: number;
};

function parseNotificationSseEvent(data: string): NotificationCreatedSseEvent | null {
  try {
    const parsed = JSON.parse(data) as Partial<NotificationCreatedSseEvent>;
    if (
      parsed.type === 'notification.created' &&
      typeof parsed.notification_id === 'string' &&
      typeof parsed.unread_count === 'number'
    ) {
      return parsed as NotificationCreatedSseEvent;
    }
  } catch {
    /* ignore malformed payloads */
  }
  return null;
}

type NotificationInboxContextValue = {
  unreadCount: number;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  refreshUnreadCount: () => Promise<void>;
};

const NotificationInboxContext = createContext<NotificationInboxContextValue | undefined>(
  undefined,
);

export function NotificationInboxProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    try {
      const { count } = await getUnreadNotificationCount();
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

    const source = new EventSource('/api/proxy/notifications/stream');

    source.onmessage = (message) => {
      const event = parseNotificationSseEvent(message.data);
      if (event) {
        setUnreadCount(event.unread_count);
        window.dispatchEvent(new CustomEvent('cosmolog:notifications-refresh-list'));
      }
    };

    return () => {
      source.close();
    };
  }, [user]);

  return (
    <NotificationInboxContext.Provider
      value={{ unreadCount, setUnreadCount, refreshUnreadCount }}
    >
      {children}
    </NotificationInboxContext.Provider>
  );
}

export function useNotificationInbox() {
  const ctx = useContext(NotificationInboxContext);
  if (!ctx) {
    throw new Error('useNotificationInbox must be used within NotificationInboxProvider');
  }
  return ctx;
}
