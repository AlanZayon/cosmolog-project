import { useState, useEffect } from 'react';
import { useSearchParams } from "next/navigation";
import { isApiConfigured, searchStories } from '@/lib/api';
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
    if (!isApiConfigured()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    searchStories(q)
      .then((data) => {
        setResults(data as StoryWithProfile[]);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
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
