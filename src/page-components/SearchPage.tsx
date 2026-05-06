import { useState, useEffect } from 'react';
import { useSearchParams } from "next/navigation";
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/hooks/useLanguage';
import Header from '@/components/Header';
import StoryCard from '@/components/StoryCard';
import type { Tables } from '@/integrations/supabase/types';

type StoryWithProfile = Tables<'stories'> & { profiles: { username: string; avatar_url: string | null } | null };

export default function SearchPage() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";
  const { t } = useLanguage();
  const [results, setResults] = useState<StoryWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!q) return;
    setLoading(true);
    supabase.from('stories').select('*')
      .ilike('title', `%${q}%`)
      .order('likes_count', { ascending: false })
      .limit(50)
      .then(async ({ data }) => {
        if (!data) { setResults([]); setLoading(false); return; }
        const authorIds = [...new Set(data.map(s => s.author_id))];
        const { data: profiles } = await supabase.from('profiles').select('user_id, username, avatar_url').in('user_id', authorIds);
        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
        setResults(data.map(s => ({ ...s, profiles: profileMap.get(s.author_id) || null })) as StoryWithProfile[]);
        setLoading(false);
      });
  }, [q]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8">
        <h1 className="text-xl font-bold mb-4">{t('search.resultsFor')} "{q}"</h1>
        {loading ? (
          <p className="text-muted-foreground">{t('search.searching')}</p>
        ) : results.length === 0 ? (
          <p className="text-muted-foreground">{t('search.noResults')}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {results.map(s => <StoryCard key={s.id} story={s} />)}
          </div>
        )}
      </main>
    </div>
  );
}
