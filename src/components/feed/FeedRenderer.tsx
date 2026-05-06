import { useState } from 'react';
import StoryFeedCard from '@/components/feed/StoryFeedCard';
import ArcFeedCard from '@/components/feed/ArcFeedCard';
import UniverseFeedCard from '@/components/feed/UniverseFeedCard';
import type { FeedItem } from '@/lib/feed';

interface FeedRendererProps {
  items: FeedItem[];
}

export default function FeedRenderer({ items }: FeedRendererProps) {
  const [expandedArcId, setExpandedArcId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {items.map((item) => {
        if (item.type === 'story') {
          return <StoryFeedCard key={`${item.type}-${item.id}`} story={item.payload} />;
        }

        if (item.type === 'arc') {
          return (
            <ArcFeedCard
              key={`${item.type}-${item.id}`}
              arc={item.payload}
              expanded={expandedArcId === item.id}
              onToggle={() => setExpandedArcId((current) => current === item.id ? null : item.id)}
            />
          );
        }

        return <UniverseFeedCard key={`${item.type}-${item.id}`} universe={item.payload} />;
      })}
    </div>
  );
}
