import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import FeedRenderer from '@/components/feed/FeedRenderer';
import { getFeed, type FeedItem } from '@/lib/feed';
import { useLanguage } from '@/hooks/useLanguage';
import { Compass, Sparkles } from 'lucide-react';

export default function Index() {
  const { t } = useLanguage();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFeed();
  }, []);

  const fetchFeed = async () => {
    setLoading(true);
    setError(null);
    try {
      const feed = await getFeed();
      setItems(feed);
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 max-w-4xl">
        <section className="mb-8 rounded-3xl border border-border bg-card px-6 py-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <Compass className="h-6 w-6" />
            </div>
            <div className="rounded-2xl bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              {t('index.feedBadge')}
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold font-serif leading-tight">
            {t('index.title.discover')} <span className="text-gradient">{t('index.title.stories')}</span>
          </h1>
          <p className="text-muted-foreground max-w-2xl mt-3 text-base leading-relaxed">
            {t('index.feedSubtitle')}
          </p>

          <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5"><Sparkles className="h-3.5 w-3.5" /> {t('index.feedPillStories')}</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5">{t('index.feedPillArcs')}</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5">{t('index.feedPillReader')}</span>
          </div>
        </section>

        {loading ? (
          <p className="text-center text-muted-foreground">{t('index.loading')}</p>
        ) : error ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : items.length === 0 ? (
          <p className="text-center text-muted-foreground">{t('index.noStories')}</p>
        ) : (
          <FeedRenderer items={items} />
        )}
      </main>
    </div>
  );
}
