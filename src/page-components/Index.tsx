import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import FeedRenderer from '@/components/feed/FeedRenderer';
import { getFeed, type FeedItem } from '@/lib/feed';
import { useLanguage } from '@/hooks/useLanguage';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Compass, Sparkles, PenTool, Globe, ChevronDown, Library } from 'lucide-react';
import { COMMUNITY_FEED_ELEMENT_ID } from '@/lib/homeFeedNav';

export default function Index() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFeed();
  }, []);

  useEffect(() => {
    const hash = `#${COMMUNITY_FEED_ELEMENT_ID}`;
    const scrollToFeed = () => {
      if (typeof window === 'undefined' || window.location.hash !== hash) return;
      const el = document.getElementById(COMMUNITY_FEED_ELEMENT_ID);
      if (!el) return;
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    };
    scrollToFeed();
    window.addEventListener('hashchange', scrollToFeed);
    return () => window.removeEventListener('hashchange', scrollToFeed);
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
        <section className="relative mb-10 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-primary/[0.07] px-6 py-9 shadow-sm ring-1 ring-border/70 animate-fade-in md:px-10 md:py-11">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/[0.12] blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute -bottom-20 -left-12 h-56 w-56 rounded-full bg-secondary/30 blur-3xl" aria-hidden />

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-primary/15 p-3 text-primary shadow-sm ring-1 ring-primary/20">
                <Compass className="h-6 w-6" />
              </div>
              <div className="rounded-full border border-border/80 bg-background/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('index.feedBadge')}
              </div>
            </div>
          </div>

          <h1 className="relative mt-5 text-4xl font-bold font-serif leading-[1.1] tracking-tight md:text-5xl md:leading-[1.08]">
            {t('index.title.discover')} <span className="text-gradient">{t('index.title.stories')}</span>
          </h1>
          <p className="relative mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            {t('index.feedSubtitle')}
          </p>

          <p className="relative mt-8 text-sm font-semibold text-foreground">{t('index.ctaLead')}</p>
          <div className="relative mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              asChild
              size="lg"
              className="h-12 w-full min-w-[12rem] px-6 text-base font-semibold shadow-md shadow-primary/20 sm:w-auto gradient-warm text-primary-foreground hover:opacity-95"
            >
              <Link href="/create" className="inline-flex items-center justify-center gap-2">
                <PenTool className="h-5 w-5 shrink-0" aria-hidden />
                {t('index.ctaWrite')}
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 w-full border-2 border-border bg-background/90 font-medium shadow-sm backdrop-blur-sm hover:bg-accent sm:w-auto sm:min-w-[10rem]"
            >
              <Link href="/universes" className="inline-flex items-center justify-center gap-2">
                <Globe className="h-5 w-5 shrink-0" aria-hidden />
                {t('index.ctaUniverses')}
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="h-12 w-full text-muted-foreground hover:bg-accent/80 hover:text-foreground sm:w-auto">
              <a href={`#${COMMUNITY_FEED_ELEMENT_ID}`} className="inline-flex items-center justify-center gap-2">
                <Library className="h-5 w-5 shrink-0" aria-hidden />
                {t('index.ctaBrowseFeed')}
                <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
              </a>
            </Button>
          </div>

          {!user ? (
            <p className="relative mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
              <span>{t('index.guestHint')}</span>{' '}
              <Link href="/signup" className="font-semibold text-primary underline-offset-4 hover:underline">
                {t('header.signup')}
              </Link>
              <span className="mx-1.5 text-border">·</span>
              <Link href="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
                {t('header.login')}
              </Link>
            </p>
          ) : null}

          <div className="relative mt-8 rounded-2xl border border-dashed border-border/80 bg-muted/20 px-4 py-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('index.feedMechanicsLabel')}</p>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> {t('index.feedPillStories')}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5">{t('index.feedPillArcs')}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5">{t('index.feedPillReader')}</span>
            </div>
          </div>
        </section>

        <section id={COMMUNITY_FEED_ELEMENT_ID} aria-labelledby="feed-section-title" className="scroll-mt-28">
          <header className="mb-6 border-b border-border pb-5">
            <h2 id="feed-section-title" className="text-2xl font-bold font-serif text-foreground md:text-3xl">
              {t('index.feedSectionTitle')}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">{t('index.feedSectionHint')}</p>
          </header>

          {loading ? (
            <p className="text-center text-muted-foreground">{t('index.loading')}</p>
          ) : error ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-border bg-muted/20 px-6 py-10 text-center">
              <p className="text-muted-foreground">{t('index.noStories')}</p>
              <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap">
                <Button asChild className="gradient-warm text-primary-foreground">
                  <Link href="/create">{t('index.ctaWrite')}</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/universes">{t('index.ctaUniverses')}</Link>
                </Button>
              </div>
            </div>
          ) : (
            <FeedRenderer items={items} />
          )}
        </section>
      </main>
    </div>
  );
}
