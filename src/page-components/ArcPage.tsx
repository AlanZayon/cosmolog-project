import { useEffect, useState } from 'react';
import Link from "next/link";
import { useParams } from "next/navigation";
import Header from '@/components/Header';
import StoryCard from '@/components/StoryCard';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/hooks/useLanguage';
import type { Tables } from '@/integrations/supabase/types';
import type { TranslationKey } from '@/i18n/translations';

type Arc = Tables<'arcs'>;
type StoryWithProfile = Tables<'stories'> & { profiles: { username: string; avatar_url: string | null } | null };

export default function ArcPage() {
  const { id } = useParams<{ id: string }>() as { id: string };
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [arc, setArc] = useState<Arc | null>(null);
  const [universe, setUniverse] = useState<Tables<'universes'> | null>(null);
  const [stories, setStories] = useState<StoryWithProfile[]>([]);

  useEffect(() => {
    if (id) fetchArc();
  }, [id]);

  const fetchArc = async () => {
    setLoading(true);
    const { data: arcData } = await supabase.from('arcs').select('*').eq('id', id!).single();
    if (!arcData) {
      setArc(null);
      setLoading(false);
      return;
    }
    setArc(arcData);

    const [{ data: universeData }, { data: storiesData }] = await Promise.all([
      supabase.from('universes').select('*').eq('id', arcData.universe_id).single(),
      supabase.from('stories').select('*').eq('arc_id', arcData.id).order('created_at', { ascending: false }),
    ]);

    setUniverse(universeData);

    const authorIds = [...new Set((storiesData || []).map((story) => story.author_id))];
    let profileMap = new Map<string, { username: string; avatar_url: string | null }>();
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('user_id, username, avatar_url').in('user_id', authorIds);
      profileMap = new Map(profiles?.map((profile) => [profile.user_id, { username: profile.username, avatar_url: profile.avatar_url }]) || []);
    }

    setStories((storiesData || []).map((story) => ({ ...story, profiles: profileMap.get(story.author_id) || null })));
    setLoading(false);
  };

  if (loading) {
    return <div className="min-h-screen bg-background"><Header /><div className="container py-20 text-center text-muted-foreground">{t('common.loading')}</div></div>;
  }

  if (!arc) {
    return <div className="min-h-screen bg-background"><Header /><div className="container py-20 text-center text-muted-foreground">{t('universe.notFound')}</div></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 max-w-6xl animate-fade-in">
        <Link href={universe ? `/universe/${universe.id}` : '/'} className="text-sm text-primary hover:underline">
          {t('story.universe')}: {universe?.title || t('common.back')}
        </Link>

        <section className="mt-4 mb-8 rounded-2xl border border-border bg-card overflow-hidden">
          {arc.cover_image_url && (
            <div className="aspect-[16/6] overflow-hidden border-b border-border">
              <img src={arc.cover_image_url} alt={arc.name} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="p-6">
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge variant="outline">{t(`arcType.${arc.type}` as TranslationKey)}</Badge>
              <Badge variant="secondary">{stories.length} histórias</Badge>
              {universe && <Badge variant="secondary">{universe.title}</Badge>}
            </div>
            <h1 className="text-3xl font-bold font-serif">{arc.name}</h1>
            {arc.description && <p className="mt-3 text-foreground/80 max-w-2xl">{arc.description}</p>}
          </div>
        </section>

        {stories.length === 0 ? (
          <p className="text-muted-foreground">{t('universe.arcStoriesEmpty')}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {stories.map((story) => <StoryCard key={story.id} story={story} />)}
          </div>
        )}
      </main>
    </div>
  );
}
