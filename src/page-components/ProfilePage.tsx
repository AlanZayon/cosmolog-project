import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
import Link from "next/link";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import StoryCard from '@/components/StoryCard';
import { BrowseContentRow, browseLandscapeTileClass, browseStoryTileClass } from '@/components/browse/BrowseContentRow';
import { Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Tables } from '@/integrations/supabase/types';

export default function ProfilePage() {
  const { user, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [stories, setStories] = useState<Tables<'stories'>[]>([]);
  const [universes, setUniverses] = useState<Tables<'universes'>[]>([]);
  const [editing, setEditing] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const completeProfileHandled = useRef(false);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    void fetchProfile();
    void fetchStories();
    void fetchUniverses();
  }, [user, router]);

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

  const fetchProfile = async () => {
    try {
      const data = await getMyProfile();
      setProfile(data as Tables<'profiles'>);
      setUsername(data.username);
      setBio(data.bio || '');
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err instanceof ApiError ? err.message : String(err),
        variant: 'destructive',
      });
    }
  };

  const fetchStories = async () => {
    try {
      const data = await getMyStories();
      setStories(data as Tables<'stories'>[]);
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err instanceof ApiError ? err.message : String(err),
        variant: 'destructive',
      });
    }
  };

  const fetchUniverses = async () => {
    try {
      const data = await getMyUniverses();
      setUniverses(data as Tables<'universes'>[]);
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err instanceof ApiError ? err.message : String(err),
        variant: 'destructive',
      });
    }
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
      await refreshProfile();
      await fetchProfile();
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
      await refreshProfile();
      await fetchProfile();
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

        {stories.length === 0 ? (
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

        {universes.length === 0 ? (
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
