import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { supabase } from '@/integrations/supabase/client';
import Link from "next/link";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import StoryCard from '@/components/StoryCard';
import { useRouter } from "next/navigation";
import { Camera } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

export default function ProfilePage() {
  const { user, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [stories, setStories] = useState<Tables<'stories'>[]>([]);
  const [universes, setUniverses] = useState<Tables<'universes'>[]>([]);
  const [editing, setEditing] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    fetchProfile();
    fetchStories();
    fetchUniverses();
  }, [user, router]);

  const fetchProfile = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('user_id', user!.id).single();
    if (data) { setProfile(data); setUsername(data.username); setBio(data.bio || ''); }
  };

  const fetchStories = async () => {
    const { data } = await supabase.from('stories').select('*').eq('author_id', user!.id).order('created_at', { ascending: false });
    if (data) setStories(data);
  };

  const fetchUniverses = async () => {
    const { data } = await supabase.from('universes').select('*').eq('owner_id', user!.id).order('created_at', { ascending: false });
    if (data) setUniverses(data);
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
      const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, file);
      if (uploadErr) throw uploadErr;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const { error } = await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('user_id', user.id);
      if (error) throw error;
      toast({ title: t('profile.avatarUpdated') });
      await refreshProfile();
      fetchProfile();
    } catch (err: any) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    const { error } = await supabase.from('profiles').update({ username, bio }).eq('user_id', user!.id);
    if (error) { toast({ title: t('common.error'), description: error.message, variant: 'destructive' }); return; }
    toast({ title: t('profile.updated') });
    setEditing(false);
    await refreshProfile();
    fetchProfile();
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 max-w-2xl animate-fade-in">
        <div className="flex items-center gap-4 mb-8">
          <div className="relative group">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.username} className="h-16 w-16 rounded-full object-cover border-2 border-border" />
            ) : (
              <div className="h-16 w-16 rounded-full gradient-warm flex items-center justify-center text-primary-foreground text-xl font-bold">
                {profile?.username?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute inset-0 rounded-full bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            >
              <Camera className="h-5 w-5 text-foreground" />
            </button>
            <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </div>
          <div className="flex-1">
            {editing ? (
              <div className="space-y-2">
                <Input value={username} onChange={e => setUsername(e.target.value)} placeholder={t('profile.usernamePlaceholder')} />
                <Textarea value={bio} onChange={e => setBio(e.target.value)} placeholder={t('profile.bioPlaceholder')} rows={2} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSave}>{t('common.save')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>{t('common.cancel')}</Button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-xl font-bold">{profile?.username}</h1>
                <p className="text-sm text-muted-foreground">{profile?.bio || t('profile.noBio')}</p>
                <Button size="sm" variant="ghost" className="mt-1" onClick={() => setEditing(true)}>{t('profile.editProfile')}</Button>
              </>
            )}
          </div>
        </div>

        <h2 className="text-lg font-semibold mb-4">{t('profile.myStories')}</h2>
        {stories.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('profile.noStories')}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {stories.map(s => <StoryCard key={s.id} story={s} />)}
          </div>
        )}

        <h2 className="text-lg font-semibold mb-4 mt-8">{t('profile.myUniverses')}</h2>
        {universes.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('profile.noUniverses')}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {universes.map(u => (
              <Link key={u.id} href={`/universe/${u.id}`} className="group block rounded-lg border border-border overflow-hidden hover:shadow-md transition-shadow">
                {u.cover_image_url ? (
                  <img src={u.cover_image_url} alt={u.title} className="w-full h-28 object-cover" />
                ) : (
                  <div className="w-full h-28 bg-muted flex items-center justify-center text-muted-foreground text-3xl font-bold">
                    {u.title[0]?.toUpperCase()}
                  </div>
                )}
                <div className="p-2">
                  <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{u.title}</h3>
                  {u.description && <p className="text-xs text-muted-foreground truncate">{u.description}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
