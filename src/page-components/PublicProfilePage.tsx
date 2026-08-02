"use client";

import { useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Header from '@/components/Header';
import StoryCard from '@/components/StoryCard';
import ProfileNotificationButton, {
  ProfileNotificationLoginPrompt,
} from '@/components/profile/ProfileNotificationButton';
import { BrowseContentRow, browseLandscapeTileClass, browseStoryTileClass } from '@/components/browse/BrowseContentRow';
import {
  LandscapeShelfSkeleton,
  ProfileHeroSkeleton,
  StoryShelfSkeleton,
} from '@/components/loading/skeletons';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/use-toast';
import {
  ApiError,
  getProfileByUsername,
  getProfileStoriesByUsername,
  getProfileUniversesByUsername,
} from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import NotificationLampIcon from '@/components/NotificationLampIcon';
import { cn } from '@/lib/utils';

export default function PublicProfilePage() {
  const params = useParams();
  const rawUsername = typeof params.username === 'string' ? params.username : '';
  const username = rawUsername ? decodeURIComponent(rawUsername) : '';
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  const profileQuery = useQuery({
    queryKey: queryKeys.profile.byUsername(username),
    queryFn: () => getProfileByUsername(username),
    enabled: Boolean(username),
    staleTime: 60_000,
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });

  const storiesQuery = useQuery({
    queryKey: queryKeys.profile.storiesByUsername(username),
    queryFn: () => getProfileStoriesByUsername(username),
    enabled: Boolean(username) && profileQuery.isSuccess,
    staleTime: 60_000,
  });

  const universesQuery = useQuery({
    queryKey: queryKeys.profile.universesByUsername(username),
    queryFn: () => getProfileUniversesByUsername(username),
    enabled: Boolean(username) && profileQuery.isSuccess,
    staleTime: 60_000,
  });

  const profile = profileQuery.data ?? null;
  const stories = storiesQuery.data ?? [];
  const universes = universesQuery.data ?? [];
  const notFound = profileQuery.isError && profileQuery.error instanceof ApiError && profileQuery.error.status === 404;
  const loading =
    Boolean(username) &&
    (profileQuery.isPending ||
      (profileQuery.isSuccess && (storiesQuery.isPending || universesQuery.isPending)));

  const isOwnProfile = Boolean(user && profile && user.id === profile.user_id);
  const showNotificationControl = stories.length > 0 && !isOwnProfile;

  useEffect(() => {
    if (!profileQuery.error || notFound) return;
    toast({
      title: t('common.error'),
      description:
        profileQuery.error instanceof ApiError
          ? profileQuery.error.message
          : String(profileQuery.error),
      variant: 'destructive',
    });
  }, [profileQuery.error, notFound, t, toast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container max-w-6xl py-8">
          <span className="sr-only">{t('common.loading')}</span>
          <ProfileHeroSkeleton />
          <StoryShelfSkeleton />
          <LandscapeShelfSkeleton />
        </main>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container max-w-6xl py-20 text-center text-muted-foreground">
          {t('publicProfile.notFound')}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container max-w-6xl py-8 animate-fade-in">
        <div className="relative mb-10 overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-background to-muted/40 shadow-card">
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent"
            aria-hidden
          />
          <div className="relative flex flex-col gap-6 p-6 md:p-8">
            <div className="flex min-w-0 flex-1 flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
              <div className="shrink-0">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.username}
                    className="h-24 w-24 rounded-full border-2 border-border object-cover shadow-sm sm:h-28 sm:w-28"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-border text-2xl font-bold text-primary-foreground gradient-warm shadow-sm sm:h-28 sm:w-28">
                    {profile.username[0]?.toUpperCase() || '?'}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-balance font-serif text-2xl font-bold tracking-tight sm:text-3xl">
                  {profile.username}
                </h1>
                <p className="mt-2 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {profile.bio || t('profile.noBio')}
                </p>
              </div>
            </div>

            {showNotificationControl ? (
              <div className="rounded-xl border border-primary/15 bg-gradient-to-br from-primary/8 via-background to-muted/30 p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/20">
                      <NotificationLampIcon active={false} size="md" className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{t('notifications.followCardTitle')}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                        {t('notifications.followCardHint')}
                      </p>
                    </div>
                  </div>
                  <div className="w-full shrink-0 sm:w-auto sm:min-w-[12.5rem]">
                    {user ? (
                      <ProfileNotificationButton
                        username={profile.username}
                        authorId={profile.user_id}
                        universes={universes}
                      />
                    ) : (
                      <ProfileNotificationLoginPrompt />
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {stories.length === 0 ? (
          <p className="mb-10 text-sm text-muted-foreground">{t('publicProfile.noStories')}</p>
        ) : (
          <BrowseContentRow title={t('publicProfile.stories')}>
            {stories.map((story) => (
              <div key={story.id} className={browseStoryTileClass()}>
                <StoryCard story={story} />
              </div>
            ))}
          </BrowseContentRow>
        )}

        {universes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('publicProfile.noUniverses')}</p>
        ) : (
          <BrowseContentRow title={t('publicProfile.universes')}>
            {universes.map((universe) => (
              <Link
                key={universe.id}
                href={`/universe/${universe.id}`}
                className={cn(
                  browseLandscapeTileClass(),
                  'group block overflow-hidden rounded-xl border border-border bg-card shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-warm',
                )}
              >
                <div className="aspect-[16/10] overflow-hidden bg-muted">
                  {universe.cover_image_url ? (
                    <img
                      src={universe.cover_image_url}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-muted-foreground/40">
                      {universe.title[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary">
                    {universe.title}
                  </h3>
                  {universe.description ? (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{universe.description}</p>
                  ) : null}
                </div>
              </Link>
            ))}
          </BrowseContentRow>
        )}
      </main>
    </div>
  );
}
