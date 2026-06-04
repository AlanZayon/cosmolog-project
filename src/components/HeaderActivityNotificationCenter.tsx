"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLanguage } from '@/hooks/useLanguage';
import { useActivityNotificationInbox } from '@/hooks/useActivityNotificationInbox';
import { useToast } from '@/hooks/use-toast';
import {
  ApiError,
  listActivityNotifications,
  markActivityNotificationRead,
  markAllActivityNotificationsRead,
} from '@/lib/api';
import type { ApiActivityNotificationListItem } from '@/lib/api/types';
import { formatCommentRelative } from '@/lib/formatDate';
import { ActivityNotificationUnreadDot } from '@/components/ActivityNotificationUnreadDot';
import TranslationWithParams from '@/components/TranslationWithParams';
import type { TranslationKey } from '@/i18n/translations';
import { storyCommentPath } from '@/lib/storyCommentNav';
import { cn } from '@/lib/utils';

const RECENT_LIMIT = 20;

function formatBadgeCount(count: number): string {
  if (count > 99) return '99+';
  if (count > 9) return '9+';
  return String(count);
}

function activityNotificationPath(item: ApiActivityNotificationListItem): string | null {
  switch (item.kind) {
    case 'comment_mention':
    case 'story_comment':
    case 'comment_reply':
    case 'comment_liked':
      return item.story_id
        ? storyCommentPath(item.story_id, item.comment_id)
        : null;
    case 'profile_alert_activated':
      return `/profile/${item.actor_username}`;
    case 'universe_alert_activated':
      return item.universe_id ? `/universe/${item.universe_id}` : null;
    case 'collection_saved':
      return item.collection_id
        ? `/library?collection=${item.collection_id}`
        : null;
    default:
      return null;
  }
}

function activityNotificationMessage(item: ApiActivityNotificationListItem): {
  key: TranslationKey;
  params: Record<string, string>;
} {
  const username = item.actor_username;
  const story = item.story_title ?? '';
  switch (item.kind) {
    case 'comment_mention':
      return {
        key: 'activityNotifications.inboxCommentMention',
        params: { username, story },
      };
    case 'story_comment':
      return {
        key: 'activityNotifications.inboxStoryComment',
        params: { username, story },
      };
    case 'comment_reply':
      return {
        key: 'activityNotifications.inboxCommentReply',
        params: { username, story },
      };
    case 'comment_liked':
      return {
        key: 'activityNotifications.inboxCommentLiked',
        params: { username, story },
      };
    case 'profile_alert_activated':
      return {
        key: 'activityNotifications.inboxProfileAlert',
        params: { username },
      };
    case 'universe_alert_activated':
      return {
        key: 'activityNotifications.inboxUniverseAlert',
        params: { username, universe: item.universe_title ?? '' },
      };
    case 'collection_saved':
      return {
        key: 'activityNotifications.inboxCollectionSaved',
        params: { username, collection: item.collection_name ?? '' },
      };
    default:
      return { key: 'activityNotifications.inboxProfileAlert', params: { username } };
  }
}

type HeaderActivityNotificationCenterProps = {
  className?: string;
  iconClassName?: string;
};

export default function HeaderActivityNotificationCenter({
  className,
  iconClassName,
}: HeaderActivityNotificationCenterProps) {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { unreadCount, setUnreadCount, refreshUnreadCount } = useActivityNotificationInbox();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ApiActivityNotificationListItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const openRef = useRef(open);
  openRef.current = open;

  const refreshList = useCallback(async () => {
    setLoadingList(true);
    try {
      const { items: next } = await listActivityNotifications({ limit: RECENT_LIMIT });
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
    const onRefresh = () => {
      if (openRef.current) {
        void refreshList();
      }
    };
    window.addEventListener('cosmolog:activity-notifications-refresh-list', onRefresh);
    return () => {
      window.removeEventListener('cosmolog:activity-notifications-refresh-list', onRefresh);
    };
  }, [refreshList]);

  const handleMarkAllRead = () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    void (async () => {
      try {
        await markAllActivityNotificationsRead();
        setUnreadCount(0);
        setItems((prev) =>
          prev.map((n) =>
            n.read_at == null
              ? {
                  ...n,
                  read_at: new Date().toISOString(),
                  clicked_at: new Date().toISOString(),
                }
              : n,
          ),
        );
        await refreshUnreadCount();
      } catch (err) {
        toast({
          title: t('common.error'),
          description: err instanceof ApiError ? err.message : String(err),
          variant: 'destructive',
        });
      } finally {
        setMarkingAll(false);
      }
    })();
  };

  const handleItemClick = (item: ApiActivityNotificationListItem) => {
    const path = activityNotificationPath(item);
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
          await markActivityNotificationRead(item.id);
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
        if (path) {
          router.push(path);
        }
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
          className={cn(
            'relative h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground',
            className,
          )}
          title={t('activityNotifications.title')}
          aria-label={
            unreadCount > 0
              ? `${t('activityNotifications.title')} (${unreadCount})`
              : t('activityNotifications.title')
          }
        >
          <Bell className={cn('h-5 w-5', iconClassName)} aria-hidden />
          {unreadCount > 0 ? (
            <ActivityNotificationUnreadDot className="right-0.5 top-0.5" />
          ) : null}
          {unreadCount > 0 ? (
            <span className="sr-only">{formatBadgeCount(unreadCount)}</span>
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
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <p className="text-sm font-semibold text-foreground">{t('activityNotifications.title')}</p>
          {unreadCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 px-2 text-xs font-medium"
              disabled={markingAll}
              onClick={handleMarkAllRead}
            >
              {t('activityNotifications.markAllRead')}
            </Button>
          ) : null}
        </div>
        {loadingList ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            <span className="sr-only">{t('common.loading')}</span>
          </div>
        ) : items.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-muted-foreground">
            {t('activityNotifications.empty')}
          </p>
        ) : (
          <ScrollArea className="max-h-[min(70dvh,20rem)]">
            <ul className="divide-y divide-border py-0.5">
              {items.map((item) => {
                const unread = item.read_at == null;
                const message = activityNotificationMessage(item);
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
                        {item.actor_avatar_url ? (
                          <img
                            src={item.actor_avatar_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-muted-foreground">
                            {item.actor_username[0]?.toUpperCase() || '?'}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'line-clamp-3 text-sm leading-snug',
                            unread ? 'font-medium text-foreground' : 'text-foreground/90',
                          )}
                        >
                          <TranslationWithParams
                            translationKey={message.key}
                            language={language}
                            params={message.params}
                          />
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
