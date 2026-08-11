"use client";

import { useEffect, useState } from 'react';
import {
  getArc,
  getProfileByUserId,
  getStoryById,
  getStoryChapters,
  getComicPages,
  getUniverseById,
} from '@/lib/api';
import { getBlocks } from '@/lib/api/content';
import { useLanguage } from '@/hooks/useLanguage';
import type { Tables } from '@/integrations/supabase/types';
import { loadBlocks, normalizeStoryType, type StoryBlockRow } from '@/lib/storyBlocks';
import { StoryReaderSkeleton } from '@/components/loading/skeletons';
import StoryFeedPreviewView, {
  type StoryFeedPreviewData,
  type StoryWithProfile,
} from '@/components/feed/StoryFeedPreviewView';

export type { StoryWithProfile } from '@/components/feed/StoryFeedPreviewView';

export interface StoryFeedPreviewProps {
  storyId: string;
  enabled?: boolean;
  mode?: 'peek' | 'full';
  fullPageMode?: 'link' | 'action' | 'none';
  onOpenFullPage?: () => void;
  onNavigateArc?: (arcId: string) => void;
  onNavigateUniverse?: (universeId: string) => void;
  titleAs?: 'h1' | 'h2' | 'span';
}

export default function StoryFeedPreview({
  storyId,
  enabled = true,
  mode = 'full',
  fullPageMode = 'link',
  onOpenFullPage,
  onNavigateArc,
  onNavigateUniverse,
  titleAs = 'h1',
}: StoryFeedPreviewProps) {
  const { t } = useLanguage();
  const peek = mode === 'peek';
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StoryFeedPreviewData | null>(null);

  useEffect(() => {
    if (!enabled || !storyId) return;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      const storyData = await getStoryById(storyId);

      if (cancelled) return;

      const [profile, universe, arc] = await Promise.all([
        getProfileByUserId(storyData.author_id).catch(() => null),
        storyData.universe_id
          ? getUniverseById(storyData.universe_id).catch(() => null)
          : Promise.resolve(null),
        storyData.arc_id ? getArc(storyData.arc_id).catch(() => null) : Promise.resolve(null),
      ]);

      if (cancelled) return;

      const story: StoryWithProfile = {
        ...storyData,
        profiles: profile ? { username: profile.username } : null,
        universe: universe ? { id: universe.id, title: universe.title } : null,
        arc: arc ? { id: arc.id, name: arc.name } : null,
      };

      const normalizedType = normalizeStoryType(storyData.type);
      let chapters: Tables<'chapters'>[] = [];
      let chapterBlocksMap: Record<string, StoryBlockRow[]> = {};
      let comicPages: StoryFeedPreviewData['comicPages'] = [];
      let shortStoryBlocks: StoryBlockRow[] = [];

      if (normalizedType === 'chapters') {
        const ch = await getStoryChapters(storyId);
        if (!cancelled) chapters = ch as Tables<'chapters'>[];

        const map: Record<string, StoryBlockRow[]> = {};
        for (const chapter of ch) {
          const blocks = await getBlocks(storyId, chapter.id);
          map[chapter.id] = blocks as StoryBlockRow[];
        }
        if (!cancelled) chapterBlocksMap = map;
      }

      if (normalizedType === 'comic') {
        const pages = await getComicPages(storyId);
        if (!cancelled) comicPages = pages as Tables<'comic_pages'>[];
      }

      if (normalizedType === 'short_story') {
        const blocks = await loadBlocks(storyId, null);
        if (!cancelled) shortStoryBlocks = blocks;
      }

      if (!cancelled) {
        setData({ story, chapters, comicPages, shortStoryBlocks, chapterBlocksMap });
        setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [enabled, storyId]);

  if (loading) {
    return (
      <div className={peek ? 'min-h-[28vh] py-6' : 'min-h-[40vh] bg-background p-4 sm:p-8'}>
        <span className="sr-only">{t('common.loading')}</span>
        <StoryReaderSkeleton />
      </div>
    );
  }

  if (!data) {
    return (
      <div className={peek ? 'min-h-[28vh] py-12 text-center text-muted-foreground' : 'min-h-[40vh] bg-background p-8 text-center text-muted-foreground'}>
        {t('common.noContent')}
      </div>
    );
  }

  return (
    <StoryFeedPreviewView
      data={data}
      mode={mode}
      fullPageMode={fullPageMode}
      onOpenFullPage={onOpenFullPage}
      onNavigateArc={onNavigateArc}
      onNavigateUniverse={onNavigateUniverse}
      titleAs={titleAs}
    />
  );
}
