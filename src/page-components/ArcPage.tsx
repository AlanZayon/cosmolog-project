import { useEffect, useState } from 'react';
import Link from "next/link";
import { useParams } from "next/navigation";
import Header from '@/components/Header';
import PreviousScreenBackButton from '@/components/PreviousScreenBackButton';
import StoryCard from '@/components/StoryCard';
import { BrowseContentRow, browseStoryTileClass } from '@/components/browse/BrowseContentRow';
import { UniverseDetailSkeleton } from '@/components/loading/skeletons';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ApiError,
  createArcLoreLink,
  deleteArcLoreLink,
  getArc,
  getArcStories,
  getUniverseById,
  listArcLoreLinks,
} from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/use-toast';
import { entryPagePath } from '@/lib/codex/sections';
import type { ApiLoreEntry } from '@/lib/api/types';
import type { Tables } from '@/integrations/supabase/types';
import type { TranslationKey } from '@/i18n/translations';

type Arc = Tables<'arcs'>;
type StoryWithProfile = Tables<'stories'> & { profiles: { username: string; avatar_url: string | null } | null };

export type ArcPageProps = {
  embedExploration?: boolean;
  arcIdOverride?: string;
  explorationPushStory?: (storyId: string) => void;
  explorationPushUniverse?: (universeId: string) => void;
};

export default function ArcPage({
  embedExploration = false,
  arcIdOverride,
  explorationPushStory,
  explorationPushUniverse,
}: ArcPageProps = {}) {
  const params = useParams<{ id: string }>();
  const id = (arcIdOverride ?? params?.id) as string | undefined;
  const { t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [arc, setArc] = useState<Arc | null>(null);
  const [universe, setUniverse] = useState<Tables<'universes'> | null>(null);
  const [stories, setStories] = useState<StoryWithProfile[]>([]);
  const [loreLinks, setLoreLinks] = useState<ApiLoreEntry[]>([]);
  const [linkEntryId, setLinkEntryId] = useState('');
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    if (id) fetchArc();
  }, [id]);

  const fetchArc = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const arcData = await getArc(id);
      setArc(arcData as Arc);
      const [universeData, storiesData, linked] = await Promise.all([
        getUniverseById(arcData.universe_id),
        getArcStories(id),
        listArcLoreLinks(id),
      ]);
      setUniverse(universeData as Tables<'universes'>);
      setStories(storiesData as StoryWithProfile[]);
      setLoreLinks(linked);
    } catch {
      setArc(null);
    } finally {
      setLoading(false);
    }
  };

  const isOwner = Boolean(user && universe && user.id === universe.owner_id);

  const addLoreLink = async () => {
    if (!id || !linkEntryId.trim()) return;
    setLinking(true);
    try {
      await createArcLoreLink(id, linkEntryId.trim());
      const linked = await listArcLoreLinks(id);
      setLoreLinks(linked);
      setLinkEntryId('');
      toast({ title: t('codex.arcLinkAdded') });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err);
      toast({ title: t('common.error'), description: message, variant: 'destructive' });
    } finally {
      setLinking(false);
    }
  };

  const removeLoreLink = async (entryId: string) => {
    if (!id) return;
    try {
      await deleteArcLoreLink(id, entryId);
      setLoreLinks((prev) => prev.filter((e) => e.id !== entryId));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err);
      toast({ title: t('common.error'), description: message, variant: 'destructive' });
    }
  };

  const shell = embedExploration ? 'min-h-full bg-background' : 'min-h-screen bg-background';

  if (!id) {
    return (
      <div className={shell}>
        {!embedExploration && <Header />}
        <main className="container max-w-6xl py-8">
          <span className="sr-only">{t('common.loading')}</span>
          <UniverseDetailSkeleton />
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={shell}>
        {!embedExploration && <Header />}
        {!embedExploration && (
          <div className="container max-w-6xl py-6">
            <PreviousScreenBackButton />
          </div>
        )}
        <main className="container max-w-6xl py-8">
          <span className="sr-only">{t('common.loading')}</span>
          <UniverseDetailSkeleton />
        </main>
      </div>
    );
  }

  if (!arc) {
    return (
      <div className={shell}>
        {!embedExploration && <Header />}
        {!embedExploration && (
          <div className="container max-w-6xl py-6">
            <PreviousScreenBackButton />
          </div>
        )}
        <div className="container py-20 text-center text-muted-foreground">{t('universe.notFound')}</div>
      </div>
    );
  }

  return (
    <div className={shell}>
      {!embedExploration && <Header />}
      <main className="container min-w-0 max-w-6xl py-8 animate-fade-in">
        {!embedExploration && (
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <PreviousScreenBackButton />
          </div>
        )}
        <div className={cn('mb-6', !embedExploration && '-mx-8 px-8')}>
          {embedExploration && universe && explorationPushUniverse ? (
            <button
              type="button"
              className="text-sm text-primary hover:underline"
              onClick={() => explorationPushUniverse(universe.id)}
            >
              {t('story.universe')}: {universe.title}
            </button>
          ) : (
            <Link href={universe ? `/universe/${universe.id}` : '/'} className="text-sm text-primary hover:underline">
              {t('story.universe')}: {universe?.title || t('common.back')}
            </Link>
          )}
        </div>

        <div className={cn('relative mb-10', !embedExploration && '-mx-8')}>
          {arc.cover_image_url ? (
            <div className="relative overflow-hidden border border-border sm:rounded-2xl">
              <div className="relative aspect-[2/1] min-h-[12rem] max-h-[min(44vh,22rem)] w-full sm:aspect-[21/9] sm:max-h-[min(48vh,26rem)]">
                <img src={arc.cover_image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-background from-[38%] via-background/65 to-transparent" aria-hidden />
                <div className="absolute inset-0 bg-gradient-to-r from-background/85 via-transparent to-transparent sm:from-background/70" aria-hidden />
              </div>
              <div className="absolute inset-x-0 bottom-0 space-y-2 p-5 md:p-8">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{t(`arcType.${arc.type}` as TranslationKey)}</Badge>
                  <Badge variant="secondary">{t('feed.storyCountBadge').replace(/\{\{n\}\}/g, String(stories.length))}</Badge>
                  {universe ? <Badge variant="secondary">{universe.title}</Badge> : null}
                </div>
                <h1 className="text-balance font-serif text-2xl font-bold tracking-tight sm:text-4xl">{arc.name}</h1>
                {arc.description ? (
                  <p className="max-w-3xl text-pretty text-sm leading-relaxed text-foreground/85 line-clamp-4 sm:text-base">{arc.description}</p>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-gradient-to-br from-card via-background to-muted/40 p-6 md:p-8">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{t(`arcType.${arc.type}` as TranslationKey)}</Badge>
                <Badge variant="secondary">{t('feed.storyCountBadge').replace(/\{\{n\}\}/g, String(stories.length))}</Badge>
                {universe ? <Badge variant="secondary">{universe.title}</Badge> : null}
              </div>
              <h1 className="mt-3 text-balance font-serif text-2xl font-bold tracking-tight sm:text-4xl">{arc.name}</h1>
              {arc.description ? <p className="mt-3 max-w-3xl text-pretty text-foreground/80">{arc.description}</p> : null}
            </div>
          )}
        </div>

        <section className="mb-10 space-y-3">
          <h2 className="text-lg font-semibold">{t('codex.arcLoreLinks')}</h2>
          {loreLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('codex.noArcLoreLinks')}</p>
          ) : (
            <ul className="space-y-2">
              {loreLinks.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <Link
                    href={universe ? entryPagePath(universe.id, entry.slug) : '#'}
                    className="text-primary hover:underline"
                  >
                    {entry.title}
                    <span className="ml-2 text-muted-foreground">({entry.kind})</span>
                  </Link>
                  {isOwner && !embedExploration ? (
                    <Button type="button" size="sm" variant="ghost" onClick={() => removeLoreLink(entry.id)}>
                      {t('common.delete')}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {isOwner && !embedExploration ? (
            <div className="flex flex-wrap gap-2">
              <Input
                className="max-w-sm"
                placeholder={t('codex.arcLinkEntryId')}
                value={linkEntryId}
                onChange={(e) => setLinkEntryId(e.target.value)}
              />
              <Button type="button" size="sm" variant="outline" onClick={addLoreLink} disabled={linking || !linkEntryId.trim()}>
                {linking ? t('common.saving') : t('codex.addArcLink')}
              </Button>
            </div>
          ) : null}
        </section>

        {stories.length === 0 ? (
          <p className="text-muted-foreground">{t('universe.arcStoriesEmpty')}</p>
        ) : (
          <BrowseContentRow title={t('arc.storiesInArc')} bleed={!embedExploration}>
            {stories.map((story) => (
              <div key={story.id} className={browseStoryTileClass()}>
                <StoryCard
                  story={story}
                  onOpenInFeedExplore={explorationPushStory ? () => explorationPushStory(story.id) : undefined}
                />
              </div>
            ))}
          </BrowseContentRow>
        )}
      </main>
    </div>
  );
}
