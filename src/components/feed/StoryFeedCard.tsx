import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import StoryFeedReader from '@/components/feed/StoryFeedReader';
import { useLanguage } from '@/hooks/useLanguage';
import { Heart, MessageCircle, BookOpen } from 'lucide-react';
import type { FeedStoryPayload } from '@/lib/feed';
import type { TranslationKey } from '@/i18n/translations';

interface StoryFeedCardProps {
  story: FeedStoryPayload;
  compact?: boolean;
}

export default function StoryFeedCard({ story, compact = false }: StoryFeedCardProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  if (compact) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="w-full rounded-xl border border-border bg-background p-3 text-left transition-colors hover:bg-accent"
        >
          <div className="flex items-start gap-3">
            {story.coverImageUrl && (
              <img src={story.coverImageUrl} alt={story.title} className="h-16 w-12 rounded-md object-cover border border-border" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold line-clamp-1">{story.title}</p>
              <p className="text-xs text-muted-foreground line-clamp-1">{t('common.by')} {story.author.username}</p>
              {(story.preview.text || story.description) && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {story.preview.text || story.description}
                </p>
              )}
            </div>
          </div>
        </button>
        <StoryFeedReader open={open} storyId={story.id} onOpenChange={setOpen} />
      </>
    );
  }

  return (
    <>
      <article className="rounded-2xl border border-border bg-card overflow-hidden shadow-card">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen(true);
            }
          }}
          className="block w-full cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {story.preview.kind === 'image' && story.preview.imageUrl ? (
            <div className="aspect-[16/10] overflow-hidden border-b border-border bg-muted">
              <img src={story.preview.imageUrl} alt={story.title} className="w-full h-full object-cover" />
            </div>
          ) : null}

          <div className="p-5">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Badge variant="outline">{t((`typeLabel.${story.storyType}`) as TranslationKey)}</Badge>
              {story.universe && <Badge variant="secondary">{story.universe.title}</Badge>}
              {story.arc && <Badge variant="secondary">{story.arc.name}</Badge>}
            </div>

            <h2 className="text-2xl font-semibold font-serif leading-tight">{story.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t('common.by')} {story.author.username}</p>

            {story.preview.kind === 'text' ? (
              <div className="mt-4 text-base leading-relaxed text-foreground/90 whitespace-pre-wrap">
                {story.preview.text || story.description || t('common.noContent')}
              </div>
            ) : story.description ? (
              <p className="mt-4 text-base leading-relaxed text-foreground/80">{story.description}</p>
            ) : null}

            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Heart className="h-4 w-4" /> {story.stats.likes}</span>
                <span className="flex items-center gap-1"><MessageCircle className="h-4 w-4" /> {story.stats.comments}</span>
              </div>
              <Button type="button" size="sm" className="gradient-warm text-primary-foreground">
                <BookOpen className="h-4 w-4 mr-1" /> {t('story.readNow')}
              </Button>
            </div>
          </div>
        </div>
      </article>

      <StoryFeedReader open={open} storyId={story.id} onOpenChange={setOpen} />
    </>
  );
}
