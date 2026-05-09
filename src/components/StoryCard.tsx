"use client";

import Link from "next/link";
import { Heart, MessageCircle, FileText, BookOpen, Image, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/hooks/useLanguage';
import type { Tables } from '@/integrations/supabase/types';
import type { TranslationKey } from '@/i18n/translations';

const TYPE_CONFIG: Record<string, { labelKey: TranslationKey; icon: React.ReactNode }> = {
  short_story: { labelKey: 'typeLabel.short_story', icon: <FileText className="h-3 w-3" /> },
  chapters: { labelKey: 'typeLabel.chapters', icon: <BookOpen className="h-3 w-3" /> },
  comic: { labelKey: 'typeLabel.comic', icon: <Image className="h-3 w-3" /> },
  illustrated: { labelKey: 'typeLabel.illustrated', icon: <Layers className="h-3 w-3" /> },
};

interface StoryCardProps {
  story: Tables<'stories'> & { profiles?: { username: string; avatar_url: string | null } | null };
  /** When set, opens the story in the feed exploration stack instead of navigating. */
  onOpenInFeedExplore?: () => void;
}

export default function StoryCard({ story, onOpenInFeedExplore }: StoryCardProps) {
  const { t } = useLanguage();
  const storyType = (story as any).type || 'chapters';
  const typeConfig = TYPE_CONFIG[storyType];

  const inner = (
    <>
      <div className="aspect-[3/4] bg-muted relative overflow-hidden">
        {story.cover_image_url ? (
          <img src={story.cover_image_url} alt={story.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full gradient-hero flex items-center justify-center">
            <span className="text-4xl font-serif text-primary-foreground/20">{story.title[0]}</span>
          </div>
        )}
        {typeConfig && (
          <div className="absolute top-2 left-2">
            <Badge variant="secondary" className="max-w-[min(100%,12rem)] gap-1 text-[10px] bg-background/80 backdrop-blur-sm max-sm:inline-flex max-sm:max-w-[calc(100%-2.5rem)] max-sm:truncate sm:max-w-none">
              {typeConfig.icon}{" "}
              <span className="min-w-0 max-sm:truncate">{t(typeConfig.labelKey)}</span>
            </Badge>
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-sm line-clamp-1 text-card-foreground">{story.title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t('common.by')} {story.profiles?.username || t('common.anonymous')}
        </p>
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {story.likes_count}</span>
          <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {story.comments_count}</span>
        </div>
        {(story as any).tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {(story as any).tags.slice(0, 2).map((tag: string) => (
              <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
            ))}
            {(story as any).tags.length > 2 && (
              <span className="text-[10px] text-muted-foreground">+{(story as any).tags.length - 2}</span>
            )}
          </div>
        )}
      </div>
    </>
  );

  if (onOpenInFeedExplore) {
    return (
      <button type="button" onClick={onOpenInFeedExplore} className="group block min-w-0 w-full cursor-pointer text-left touch-manipulation">
        <div className="rounded-xl overflow-hidden shadow-card bg-card transition-all duration-300 hover:shadow-warm hover:-translate-y-1">
          {inner}
        </div>
      </button>
    );
  }

  return (
    <Link href={`/story/${story.id}`} className="group block min-w-0">
      <div className="rounded-xl overflow-hidden shadow-card bg-card transition-all duration-300 hover:shadow-warm hover:-translate-y-1">
        {inner}
      </div>
    </Link>
  );
}
