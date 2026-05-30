"use client";

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import CollectionPickerDialog from '@/components/library/CollectionPickerDialog';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/use-toast';
import { useStoryLibraryStatus } from '@/hooks/useStoryLibraryStatus';
import { toggleLike } from '@/lib/api/social';
import { cn } from '@/lib/utils';
import { Bookmark, Heart } from 'lucide-react';

interface StoryLibraryActionsProps {
  storyId: string;
  likesCount: number;
  variant?: 'page' | 'feed';
  onLikesCountChange?: (count: number) => void;
  className?: string;
}

export default function StoryLibraryActions({
  storyId,
  likesCount: initialLikesCount,
  variant = 'page',
  onLikesCountChange,
  className,
}: StoryLibraryActionsProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [likesCount, setLikesCount] = useState(initialLikesCount);

  const {
    liked,
    setLiked,
    collections,
    setCollections,
    loading,
    pickerOpen,
    openPicker,
    handlePickerOpenChange,
    savedInAny,
  } = useStoryLibraryStatus(storyId);

  useEffect(() => {
    setLikesCount(initialLikesCount);
  }, [initialLikesCount]);

  const requireAuth = useCallback(() => {
    toast({ title: t('library.loginToSaveOrLike'), variant: 'destructive' });
  }, [t, toast]);

  const isolateFromCard = (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
  };

  const handleLike = async (e: React.MouseEvent) => {
    if (variant === 'feed') isolateFromCard(e);
    if (!user) {
      requireAuth();
      return;
    }

    const prevLiked = liked;
    const prevCount = likesCount;
    const nextLiked = !liked;
    const nextCount = nextLiked ? likesCount + 1 : Math.max(0, likesCount - 1);
    setLiked(nextLiked);
    setLikesCount(nextCount);
    onLikesCountChange?.(nextCount);

    try {
      const { liked: isLiked } = await toggleLike(storyId);
      setLiked(isLiked);
      const corrected = isLiked ? prevCount + 1 : Math.max(0, prevCount - (prevLiked ? 1 : 0));
      if (isLiked !== nextLiked) {
        setLikesCount(corrected);
        onLikesCountChange?.(corrected);
      }
    } catch {
      setLiked(prevLiked);
      setLikesCount(prevCount);
      onLikesCountChange?.(prevCount);
      toast({ title: t('library.saveError'), variant: 'destructive' });
    }
  };

  const handleSaveClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (variant === 'feed') isolateFromCard(e);
    if (!user) {
      requireAuth();
      return;
    }
    await openPicker();
  };

  const pickerDialog = user ? (
    <CollectionPickerDialog
      open={pickerOpen}
      onOpenChange={handlePickerOpenChange}
      storyId={storyId}
      collections={collections}
      onCollectionsChange={setCollections}
    />
  ) : null;

  if (variant === 'feed') {
    const statButtonClass =
      'inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 text-sm tabular-nums text-muted-foreground shadow-sm transition-colors hover:bg-muted/55 hover:text-foreground active:scale-[0.99] touch-manipulation';

    return (
      <div className={cn('flex items-center gap-2', className)}>
        <button
          type="button"
          className={`${statButtonClass} ${liked ? 'border-primary/40 text-primary' : ''}`}
          aria-label={`${t('feed.likeStory')}, ${likesCount}`}
          aria-pressed={liked}
          disabled={loading}
          onClick={(e) => void handleLike(e)}
          onPointerDown={isolateFromCard}
        >
          <Heart className={`h-4 w-4 shrink-0 ${liked ? 'fill-current' : ''}`} aria-hidden />
          <span>{likesCount}</span>
        </button>
        <button
          type="button"
          className={`${statButtonClass} ${savedInAny ? 'border-primary/40 text-primary' : ''}`}
          aria-label={t('library.saveToShelf')}
          disabled={loading}
          onClick={(e) => void handleSaveClick(e)}
          onPointerDown={isolateFromCard}
        >
          <Bookmark className={`h-4 w-4 shrink-0 ${savedInAny ? 'fill-current' : ''}`} aria-hidden />
        </button>
        {pickerDialog}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <Button
        variant={liked ? 'default' : 'outline'}
        size="sm"
        onClick={(e) => void handleLike(e)}
        disabled={loading}
        className={liked ? 'gradient-warm text-primary-foreground' : ''}
      >
        <Heart className={`h-4 w-4 mr-1 ${liked ? 'fill-current' : ''}`} />
        {likesCount}
      </Button>
      <Button
        variant={savedInAny ? 'default' : 'outline'}
        size="sm"
        onClick={(e) => void handleSaveClick(e)}
        disabled={loading}
        className={savedInAny ? 'gradient-warm text-primary-foreground' : ''}
        title={t('library.saveToShelf')}
      >
        <Bookmark className={`h-4 w-4 mr-1 ${savedInAny ? 'fill-current' : ''}`} />
        {t('library.saveToShelf')}
      </Button>
      {pickerDialog}
    </div>
  );
}
