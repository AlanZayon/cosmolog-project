import { useState, useEffect } from 'react';
import { useSearchParams } from "next/navigation";
import { searchProfiles, searchStories, searchLibraryCollections } from '@/lib/api';
import ProfileSearchCard from '@/components/search/ProfileSearchCard';
import CollectionSearchCard from '@/components/search/CollectionSearchCard';
import type { ApiProfile } from '@/lib/api/types';
import type { ApiLibraryCollectionSummary } from '@/lib/api/library';
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
  const [profileResults, setProfileResults] = useState<ApiProfile[]>([]);
  const [collectionResults, setCollectionResults] = useState<ApiLibraryCollectionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!q) return;
    setLoading(true);
    Promise.all([searchProfiles(q), searchStories(q), searchLibraryCollections(q)])
      .then(([profiles, stories, collections]) => {
        setProfileResults(profiles);
        setResults(stories as StoryWithProfile[]);
        setCollectionResults(collections);
      })
      .catch(() => {
        setProfileResults([]);
        setResults([]);
        setCollectionResults([]);
      })
      .finally(() => setLoading(false));
  }, [q]);

  const handleCollectionSavedChange = (collectionId: string, saved: boolean) => {
    setCollectionResults((prev) =>
      prev.map((c) =>
        c.id === collectionId ? { ...c, is_saved_by_me: saved } : c,
      ),
    );
  };

  const hasResults =
    profileResults.length > 0 || results.length > 0 || collectionResults.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8">
        <h1 className="text-xl font-bold mb-4">{t('search.resultsFor')} "{q}"</h1>
        {loading ? (
          <p className="text-muted-foreground">{t('search.searching')}</p>
        ) : !hasResults ? (
          <p className="text-muted-foreground">{t('search.noResults')}</p>
        ) : (
          <div className="space-y-10">
            {profileResults.length > 0 ? (
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  {t('search.profilesSection')}
                </h2>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 max-w-3xl">
                  {profileResults.map((p) => (
                    <ProfileSearchCard key={p.id} profile={p} />
                  ))}
                </div>
              </section>
            ) : null}
            {collectionResults.length > 0 ? (
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  {t('search.collectionsSection')}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 max-w-3xl">
                  {collectionResults.map((c) => (
                    <CollectionSearchCard
                      key={c.id}
                      collection={c}
                      returnTo={`/search?q=${encodeURIComponent(q)}`}
                      onSavedChange={handleCollectionSavedChange}
                    />
                  ))}
                </div>
              </section>
            ) : null}
            {results.length > 0 ? (
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  {t('search.storiesSection')}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {results.map((s) => (
                    <StoryCard key={s.id} story={s} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
