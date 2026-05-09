'use client';

import StoryPage from '@/page-components/StoryPage';
import ArcPage from '@/page-components/ArcPage';
import UniversePage from '@/page-components/UniversePage';
import type { StackItem } from '@/lib/feedExplorationStorage';

export interface ExplorationFullSurfaceProps {
  item: StackItem;
  pushStory: (id: string) => void;
  pushArc: (id: string) => void;
  pushUniverse: (id: string) => void;
}

export default function ExplorationFullSurface({
  item,
  pushStory,
  pushArc,
  pushUniverse,
}: ExplorationFullSurfaceProps) {
  if ((item.surface ?? 'preview') !== 'full') return null;

  switch (item.kind) {
    case 'story':
      return <StoryPage embedExploration storyIdOverride={item.id} />;
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
