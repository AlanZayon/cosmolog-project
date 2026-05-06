import Link from "next/link";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/useLanguage';
import StoryFeedCard from '@/components/feed/StoryFeedCard';
import { ChevronDown, ChevronUp, Layers3 } from 'lucide-react';
import type { FeedArcPayload, FeedStoryPayload } from '@/lib/feed';
import type { TranslationKey } from '@/i18n/translations';

interface ArcFeedCardProps {
  arc: FeedArcPayload;
  expanded: boolean;
  onToggle: () => void;
}

export default function ArcFeedCard({ arc, expanded, onToggle }: ArcFeedCardProps) {
  const { t } = useLanguage();

  return (
    <article className="rounded-2xl border border-border bg-card overflow-hidden">
      {arc.coverImageUrl && (
        <button onClick={onToggle} className="block w-full text-left">
          <div className="aspect-[16/7] overflow-hidden border-b border-border bg-muted">
            <img src={arc.coverImageUrl} alt={arc.name} className="w-full h-full object-cover" />
          </div>
        </button>
      )}

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <button onClick={onToggle} className="min-w-0 flex-1 text-left">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Badge variant="outline">{t(`arcType.${arc.arcType}` as TranslationKey)}</Badge>
              <Badge variant="secondary">{arc.storyCount} hist.</Badge>
              <Badge variant="secondary">{arc.universe.title}</Badge>
            </div>
            <h2 className="text-2xl font-semibold font-serif leading-tight">{arc.name}</h2>
            {arc.description && <p className="mt-3 text-base leading-relaxed text-foreground/80">{arc.description}</p>}
          </button>

          <Button variant="ghost" size="icon" onClick={onToggle} aria-label={expanded ? 'Collapse arc' : 'Expand arc'}>
            {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </Button>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Layers3 className="h-4 w-4" /> {arc.storyCount} hist.
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href={`/arc/${arc.id}`}>{t('feed.exploreArc')}</Link>
          </Button>
        </div>

        {expanded && (
          <div className="mt-5 space-y-3 border-t border-border pt-4">
            {arc.stories.map((story) => (
              <StoryFeedCard
                key={story.id}
                compact
                story={{
                  id: story.id,
                  title: story.title,
                  description: null,
                  storyType: story.storyType,
                  coverImageUrl: story.coverImageUrl,
                  author: {
                    id: '',
                    username: story.author.username,
                    avatarUrl: story.author.avatarUrl,
                  },
                  universe: arc.universe,
                  arc: { id: arc.id, name: arc.name, type: arc.arcType },
                  preview: { kind: 'text', text: null, imageUrl: null },
                  stats: { likes: 0, comments: 0 },
                  createdAt: '',
                } satisfies FeedStoryPayload}
              />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
