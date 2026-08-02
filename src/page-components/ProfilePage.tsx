import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { uploadFile } from '@/lib/api/storage';
import {
  ApiError,
  getMyProfile,
  getMyStories,
  getMyUniverses,
  patchMyProfile,
} from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import Link from "next/link";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import StoryCard from '@/components/StoryCard';
import { BrowseContentRow, browseLandscapeTileClass, browseStoryTileClass } from '@/components/browse/BrowseContentRow';
import {
  LandscapeShelfSkeleton,
  ProfileHeroSkeleton,
  StoryShelfSkeleton,
} from '@/components/loading/skeletons';
import { Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Tables } from '@/integrations/supabase/types';

export default function ProfilePage() {
  const { user, loading: authLoading, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [editing, setEditing] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const completeProfileHandled = useRef(false);

  const enabled = Boolean(user) && !authLoading;

  const profileQuery = useQuery({
    queryKey: queryKeys.profile.me,
    queryFn: getMyProfile,
    enabled,
    staleTime: 60_000,
  });

  const storiesQuery = useQuery({
    queryKey: queryKeys.profile.myStories,
    queryFn: getMyStories,
    enabled,
    staleTime: 60_000,
  });

  const universesQuery = useQuery({
    queryKey: queryKeys.profile.myUniverses,
    queryFn: getMyUniverses,
    enabled,
    staleTime: 60_000,
  });

  const profile = (profileQuery.data as Tables<'profiles'> | undefined) ?? null;
  const stories = (storiesQuery.data as Tables<'stories'>[] | undefined) ?? [];
  const universes = (universesQuery.data as Tables<'universes'>[] | undefined) ?? [];
  const profileLoading = enabled && profileQuery.isPending;
  const storiesLoading = enabled && storiesQuery.isPending;
  const universesLoading = enabled && universesQuery.isPending;

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!profile) return;
    setUsername(profile.username);
    setBio(profile.bio || '');
  }, [profile?.id, profile?.username, profile?.bio]);

  useEffect(() => {
    if (searchParams.get('complete') !== '1' || completeProfileHandled.current) return;
    completeProfileHandled.current = true;
    setEditing(true);
    toast({
      title: t('auth.completeProfile.title'),
      description: t('auth.completeProfile.subtitle'),
    });
    router.replace('/profile');
  }, [searchParams, router, t, toast]);

  useEffect(() => {
    const err = profileQuery.error ?? storiesQuery.error ?? universesQuery.error;
    if (!err) return;
    toast({
      title: t('common.error'),
      description: err instanceof ApiError ? err.message : String(err),
      variant: 'destructive',
    });
  }, [profileQuery.error, storiesQuery.error, universesQuery.error, t, toast]);

  const invalidateProfile = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.me }),
      refreshProfile(),
    ]);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: t('profile.imageTooLarge'), description: t('profile.max2mb'), variant: 'destructive' });
      return;
    }
    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const publicUrl = await uploadFile('avatars', file, path);
      await patchMyProfile({ avatar_url: publicUrl });
      toast({ title: t('profile.avatarUpdated') });
      await invalidateProfile();
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err);
      toast({ title: t('common.error'), description: message, variant: 'destructive' });
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    try {
      await patchMyProfile({ username, bio });
      toast({ title: t('profile.updated') });
      setEditing(false);
      await invalidateProfile();
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err instanceof ApiError ? err.message : String(err),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container max-w-6xl py-8 animate-fade-in">
        {profileLoading ? (
          <ProfileHeroSkeleton />
        ) : (
          <div className="relative mb-10 overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-background to-muted/40 shadow-card">
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent pointer-events-none" aria-hidden />
            <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:gap-8 md:p-8">
              <div className="relative shrink-0 group">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.username} className="h-24 w-24 rounded-full border-2 border-border object-cover shadow-sm sm:h-28 sm:w-28" />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-border text-2xl font-bold text-primary-foreground gradient-warm shadow-sm sm:h-28 sm:w-28">
                    {profile?.username?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Camera className="h-6 w-6 text-foreground" />
                </button>
                <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
              </div>
              <div className="min-w-0 flex-1">
                {editing ? (
                  <div className="space-y-3">
                    <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t('profile.usernamePlaceholder')} />
                    <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder={t('profile.bioPlaceholder')} rows={3} />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={handleSave}>
                        {t('common.save')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                        {t('common.cancel')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h1 className="text-balance font-serif text-2xl font-bold tracking-tight sm:text-3xl">{profile?.username}</h1>
                    <p className="mt-2 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">{profile?.bio || t('profile.noBio')}</p>
                    <Button size="sm" variant="outline" className="mt-4 touch-manipulation" onClick={() => setEditing(true)}>
                      {t('profile.editProfile')}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {storiesLoading ? (
          <StoryShelfSkeleton />
        ) : stories.length === 0 ? (
          <p className="mb-10 text-sm text-muted-foreground">{t('profile.noStories')}</p>
        ) : (
          <BrowseContentRow title={t('profile.myStories')}>
            {stories.map((s) => (
              <div key={s.id} className={browseStoryTileClass()}>
                <StoryCard story={s} />
              </div>
            ))}
          </BrowseContentRow>
        )}

        {universesLoading ? (
          <LandscapeShelfSkeleton />
        ) : universes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('profile.noUniverses')}</p>
        ) : (
          <BrowseContentRow title={t('profile.myUniverses')}>
            {universes.map((u) => (
              <Link
                key={u.id}
                href={`/universe/${u.id}`}
                className={cn(
                  browseLandscapeTileClass(),
                  'group block overflow-hidden rounded-xl border border-border bg-card shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-warm',
                )}
              >
                <div className="aspect-[16/10] overflow-hidden bg-muted">
                  {u.cover_image_url ? (
                    <img src={u.cover_image_url} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-muted-foreground/40">{u.title[0]?.toUpperCase()}</div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary">{u.title}</h3>
                  {u.description ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{u.description}</p> : null}
                </div>
              </Link>
            ))}
          </BrowseContentRow>
        )}
      </main>
    </div>
  );
}
