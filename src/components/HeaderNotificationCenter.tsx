"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import NotificationLampIcon from '@/components/NotificationLampIcon';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLanguage } from '@/hooks/useLanguage';
import { useNotificationInbox } from '@/hooks/useNotificationInbox';
import { useToast } from '@/hooks/use-toast';
import {
  ApiError,
  consumeNotification,
  listNotifications,
} from '@/lib/api';
import type { ApiNotificationListItem } from '@/lib/api/types';
import { formatCommentRelative } from '@/lib/formatDate';
import { cn } from '@/lib/utils';

const RECENT_LIMIT = 20;

function formatBadgeCount(count: number): string {
  if (count > 99) return '99+';
  if (count > 9) return '9+';
  return String(count);
}

function notificationSummary(
  item: ApiNotificationListItem,
  tf: (
    key: 'notifications.inboxLine' | 'notifications.inboxUniverseLine',
    params: Record<string, string>,
  ) => string,
): string {
  if (item.scope === 'universe' && item.universe_title) {
    return tf('notifications.inboxUniverseLine', {
      username: item.target_username,
      universe: item.universe_title,
    });
  }
  return tf('notifications.inboxLine', { username: item.target_username });
}

export default function HeaderNotificationCenter() {
  const router = useRouter();
  const { t, tf, language } = useLanguage();
  const { toast } = useToast();
  const { unreadCount, setUnreadCount, refreshUnreadCount } = useNotificationInbox();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ApiNotificationListItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const openRef = useRef(open);
  openRef.current = open;

  const refreshList = useCallback(async () => {
    setLoadingList(true);
    try {
      const { items: next } = await listNotifications({ limit: RECENT_LIMIT });
      setItems(next);
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err instanceof ApiError ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setLoadingList(false);
    }
  }, [toast, t]);

  useEffect(() => {
    if (!open) return;
    void Promise.all([refreshList(), refreshUnreadCount()]);
  }, [open, refreshList, refreshUnreadCount]);

  useEffect(() => {
    const onInboxRefresh = () => {
      if (openRef.current) {
        void refreshList();
      }
    };
    window.addEventListener('cosmolog:notifications-refresh-list', onInboxRefresh);
    return () => {
      window.removeEventListener('cosmolog:notifications-refresh-list', onInboxRefresh);
    };
  }, [refreshList]);

  const handleItemClick = (item: ApiNotificationListItem) => {
    const storyPath = `/story/${item.story_id}`;
    const wasUnread = item.read_at == null;

    setOpen(false);

    if (wasUnread) {
      setItems((prev) =>
        prev.map((n) =>
          n.id === item.id
            ? { ...n, read_at: new Date().toISOString(), clicked_at: new Date().toISOString() }
            : n,
        ),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }

    void (async () => {
      try {
        if (wasUnread) {
          await consumeNotification(item.id);
          await refreshUnreadCount();
        }
      } catch (err) {
        if (wasUnread) {
          await refreshUnreadCount();
        }
        toast({
          title: t('common.error'),
          description: err instanceof ApiError ? err.message : String(err),
          variant: 'destructive',
        });
      } finally {
        router.push(storyPath);
      }
    })();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative h-10 w-10 shrink-0 sm:h-9 sm:w-9"
          title={t('header.notifications')}
          aria-label={
            unreadCount > 0
              ? `${t('header.notifications')} (${unreadCount})`
              : t('header.notifications')
          }
        >
          <NotificationLampIcon active={unreadCount > 0} />
          {unreadCount > 0 ? (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
              aria-hidden
            >
              {formatBadgeCount(unreadCount)}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className={cn(
          'w-[min(calc(100vw-1.5rem),20rem)] p-0',
          'max-sm:w-[min(calc(100vw-1rem),18rem)]',
        )}
      >
        <div className="border-b border-border px-3 py-2.5">
          <p className="text-sm font-semibold text-foreground">{t('header.notifications')}</p>
        </div>
        {loadingList ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            <span className="sr-only">{t('common.loading')}</span>
          </div>
        ) : items.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-muted-foreground">
            {t('header.notificationsEmpty')}
          </p>
        ) : (
          <ScrollArea className="max-h-[min(70dvh,20rem)]">
            <ul className="divide-y divide-border py-0.5">
              {items.map((item) => {
                const unread = item.read_at == null;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleItemClick(item)}
                      className={cn(
                        'flex w-full gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-accent/80',
                        unread && 'bg-accent/30',
                      )}
                    >
                      <div className="mt-0.5 h-8 w-8 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
                        {item.target_avatar_url ? (
                          <img
                            src={item.target_avatar_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-muted-foreground">
                            {item.target_username[0]?.toUpperCase() || '?'}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'line-clamp-2 text-sm leading-snug',
                            unread ? 'font-medium text-foreground' : 'text-foreground/90',
                          )}
                        >
                          {item.story_title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {notificationSummary(item, tf)}
                        </p>
                        <p className="mt-1 text-[10px] text-muted-foreground/80">
                          {formatCommentRelative(item.created_at, language)}
                        </p>
                      </div>
                      {unread ? (
                        <span
                          className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary"
                          aria-hidden
                        />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
