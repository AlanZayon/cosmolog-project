'use client';

import StoryPage from '@/page-components/StoryPage';
import ArcPage from '@/page-components/ArcPage';
import UniversePage from '@/page-components/UniversePage';
import ChapterPage from '@/page-components/ChapterPage';
import type { StackItem } from '@/lib/feedExplorationStorage';

export interface ExplorationFullSurfaceProps {
  item: StackItem;
  pushStory: (id: string) => void;
  pushArc: (id: string) => void;
  pushUniverse: (id: string) => void;
  pushChapter: (storyId: string, chapterNum: number) => void;
  navigateChapter: (storyId: string, chapterNum: number) => void;
}

export default function ExplorationFullSurface({
  item,
  pushStory,
  pushArc,
  pushUniverse,
  pushChapter,
  navigateChapter,
}: ExplorationFullSurfaceProps) {
  if ((item.surface ?? 'preview') !== 'full') return null;

  switch (item.kind) {
    case 'story':
      return (
        <StoryPage
          embedExploration
          storyIdOverride={item.id}
          explorationOpenChapter={(chapterNum) => pushChapter(item.id, chapterNum)}
          focusComments={item.focusComments}
        />
      );
    case 'chapter':
      if (item.chapterNum == null) return null;
      return (
        <ChapterPage
          embedExploration
          storyIdOverride={item.id}
          chapterNumOverride={item.chapterNum}
          explorationNavigateChapter={(chapterNum) => navigateChapter(item.id, chapterNum)}
        />
      );
    case 'arc':
      return (
        <ArcPage
          embedExploration
          arcIdOverride={item.id}
          explorationPushStory={pushStory}
          explorationPushUniverse={pushUniverse}
        />
      );
    case 'universe':
      return (
        <UniversePage
          embedExploration
          universeIdOverride={item.id}
          explorationPushStory={pushStory}
          explorationPushArc={pushArc}
        />
      );
    default:
      return null;
  }
}
