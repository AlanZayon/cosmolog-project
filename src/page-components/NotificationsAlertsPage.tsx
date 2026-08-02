"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import LibrarySearchInput from '@/components/library/LibrarySearchInput';
import { ListRowsSkeleton } from '@/components/loading/skeletons';
import NotificationLampIcon from '@/components/NotificationLampIcon';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, Globe, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/use-toast';
import {
  ApiError,
  cancelProfileSubscriptionByUsername,
  cancelUniverseSubscription,
  listNotificationSubscriptions,
} from '@/lib/api';
import type { ApiNotificationSubscriptionListItem } from '@/lib/api/types';
import {
  filterProfileAlerts,
  filterUniverseAlerts,
} from '@/lib/notificationAlertsSearch';
import { cn } from '@/lib/utils';

type AlertRowProps = {
  item: ApiNotificationSubscriptionListItem;
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  imageUrl?: string | null;
  onDeactivate: () => void;
  deactivating: boolean;
};

function AlertRow({
  href,
  icon,
  title,
  description,
  imageUrl,
  onDeactivate,
  deactivating,
}: AlertRowProps) {
  const { t } = useLanguage();

  return (
    <div className="flex gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3.5 sm:p-4">
      <Link href={href} className="shrink-0">
        {imageUrl ? (
          <div className="h-14 w-14 overflow-hidden rounded-lg border border-border bg-muted">
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
            {icon}
          </div>
        )}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="min-w-0">
          <Link href={href} className="font-semibold text-sm text-foreground hover:underline line-clamp-2">
            {title}
          </Link>
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{description}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={deactivating}
          onClick={onDeactivate}
        >
          {deactivating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            t('notifications.deactivate')
          )}
        </Button>
      </div>
    </div>
  );
}

export default function NotificationsAlertsPage() {
  const { user, loading: authLoading } = useAuth();
  const { t, tf } = useLanguage();
  const router = useRouter();
  const { toast } = useToast();

  const [items, setItems] = useState<ApiNotificationSubscriptionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profiles' | 'universes'>('profiles');
  const [profileSearchQuery, setProfileSearchQuery] = useState('');
  const [universeSearchQuery, setUniverseSearchQuery] = useState('');
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  const profileItems = useMemo(
    () => items.filter((item) => item.scope === 'profile'),
    [items],
  );

  const universeItems = useMemo(
    () => items.filter((item) => item.scope === 'universe'),
    [items],
  );

  const filteredProfileItems = useMemo(
    () => filterProfileAlerts(profileItems, profileSearchQuery),
    [profileItems, profileSearchQuery],
  );

  const filteredUniverseItems = useMemo(
    () => filterUniverseAlerts(universeItems, universeSearchQuery),
    [universeItems, universeSearchQuery],
  );

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    try {
      const { items: next } = await listNotificationSubscriptions();
      setItems(next);
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err instanceof ApiError ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    void fetchSubscriptions();
  }, [user, authLoading, router, fetchSubscriptions]);

  const handleDeactivate = async (item: ApiNotificationSubscriptionListItem) => {
    setDeactivatingId(item.id);
    try {
      if (item.scope === 'universe' && item.universe_id) {
        await cancelUniverseSubscription(item.universe_id);
      } else {
        await cancelProfileSubscriptionByUsername(item.target_username);
      }
      setItems((prev) => prev.filter((row) => row.id !== item.id));
      toast({ title: t('notifications.unsubscribed') });
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err instanceof ApiError ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setDeactivatingId(null);
    }
  };

  const renderList = (
    list: ApiNotificationSubscriptionListItem[],
    allItems: ApiNotificationSubscriptionListItem[],
    emptyKey: 'notifications.alertsEmptyProfiles' | 'notifications.alertsEmptyUniverses',
    kind: 'profile' | 'universe',
  ) => {
    if (loading) {
      return (
        <div className="py-4">
          <span className="sr-only">{t('common.loading')}</span>
          <ListRowsSkeleton count={4} />
        </div>
      );
    }

    if (allItems.length === 0) {
      return (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <NotificationLampIcon active={false} size="lg" className="text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">{t(emptyKey)}</p>
        </div>
      );
    }

    if (list.length === 0) {
      return (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t('notifications.alertsNoSearchResults')}
        </p>
      );
    }

    return (
      <ul className="flex flex-col gap-3">
        {list.map((item) => {
          const isProfile = kind === 'profile';
          const href = isProfile
            ? `/profile/${encodeURIComponent(item.target_username)}`
            : `/universe/${item.universe_id}`;
          const title = isProfile
            ? `@${item.target_username}`
            : (item.universe_title ?? t('notifications.tabUniverses'));
          const description = isProfile
            ? tf('notifications.profileAlertDesc', { username: item.target_username })
            : tf('notifications.universeAlertDesc', {
                title: item.universe_title ?? '',
                username: item.target_username,
              });

          return (
            <li key={item.id}>
              <AlertRow
                item={item}
                href={href}
                icon={
                  isProfile ? (
                    <BookOpen className="h-6 w-6" aria-hidden />
                  ) : (
                    <Globe className="h-6 w-6" aria-hidden />
                  )
                }
                title={title}
                description={description}
                imageUrl={isProfile ? item.target_avatar_url : item.universe_cover_image_url}
                onDeactivate={() => void handleDeactivate(item)}
                deactivating={deactivatingId === item.id}
              />
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container max-w-2xl py-6 sm:py-8">
        <div className="mb-6 flex items-start gap-3">
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
              'border border-primary/25 bg-primary/10',
            )}
          >
            <NotificationLampIcon active size="sm" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">
              {t('notifications.alertsPageTitle')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('notifications.alertsPageSubtitle')}
            </p>
          </div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as 'profiles' | 'universes')}
        >
          <TabsList className="mb-4 grid w-full grid-cols-2">
            <TabsTrigger value="profiles">
              {t('notifications.tabProfiles')}
              {!loading && profileItems.length > 0 ? (
                <span className="ml-1.5 text-xs text-muted-foreground">({profileItems.length})</span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="universes">
              {t('notifications.tabUniverses')}
              {!loading && universeItems.length > 0 ? (
                <span className="ml-1.5 text-xs text-muted-foreground">({universeItems.length})</span>
              ) : null}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profiles" className="mt-0">
            {!loading && profileItems.length > 0 ? (
              <LibrarySearchInput
                id="notifications-profile-search"
                value={profileSearchQuery}
                onChange={setProfileSearchQuery}
                label={t('notifications.searchProfiles')}
                placeholder={t('notifications.searchProfilesPlaceholder')}
                className="mb-4 w-full max-w-none"
              />
            ) : null}
            {renderList(
              filteredProfileItems,
              profileItems,
              'notifications.alertsEmptyProfiles',
              'profile',
            )}
          </TabsContent>
          <TabsContent value="universes" className="mt-0">
            {!loading && universeItems.length > 0 ? (
              <LibrarySearchInput
                id="notifications-universe-search"
                value={universeSearchQuery}
                onChange={setUniverseSearchQuery}
                label={t('notifications.searchUniverses')}
                placeholder={t('notifications.searchUniversesPlaceholder')}
                className="mb-4 w-full max-w-none"
              />
            ) : null}
            {renderList(
              filteredUniverseItems,
              universeItems,
              'notifications.alertsEmptyUniverses',
              'universe',
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
