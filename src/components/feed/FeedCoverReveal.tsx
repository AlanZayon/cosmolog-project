"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const LONG_PRESS_MS = 400;

interface FeedCoverRevealProps {
  /** Content image shown at rest (first page / preview image). */
  contentUrl: string;
  /** Cover shown while hovering / long-pressing. */
  coverUrl: string;
  enabled: boolean;
  onActivate: () => void;
  className?: string;
}

/**
 * Content at rest; on hover (desktop) or press-and-hold (mobile) crossfades
 * to the story cover. Long-press does not open the story.
 */
export default function FeedCoverReveal({
  contentUrl,
  coverUrl,
  enabled,
  onActivate,
  className,
}: FeedCoverRevealProps) {
  const canReveal = enabled && !!coverUrl && !!contentUrl;
  const [active, setActive] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const stopPreview = useCallback(() => {
    clearLongPress();
    setActive(false);
  }, [clearLongPress]);

  const startPreview = useCallback(() => {
    if (!canReveal) return;
    setActive(true);
  }, [canReveal]);

  useEffect(() => {
    if (!canReveal) return;
    const img = new Image();
    img.src = coverUrl;
  }, [canReveal, coverUrl]);

  useEffect(() => () => clearLongPress(), [clearLongPress]);

  const onPointerEnter = () => {
    if (!canReveal) return;
    if (typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches) {
      startPreview();
    }
  };

  const onPointerLeave = () => {
    stopPreview();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!canReveal) return;
    if (e.pointerType === 'mouse') return;
    suppressClick.current = false;
    longPressTimer.current = setTimeout(() => {
      suppressClick.current = true;
      startPreview();
    }, LONG_PRESS_MS);
  };

  const onPointerUp = () => {
    clearLongPress();
    stopPreview();
  };

  const onClick = (e: React.MouseEvent) => {
    if (suppressClick.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClick.current = false;
      return;
    }
    onActivate();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'block w-full cursor-pointer touch-manipulation text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
      )}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate();
        }
      }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={(e) => {
        if (canReveal) e.preventDefault();
      }}
    >
      <div className="relative aspect-[16/10] overflow-hidden border-b border-border bg-muted select-none">
        <img
          src={contentUrl}
          alt=""
          draggable={false}
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-500',
            active && canReveal ? 'opacity-0' : 'opacity-100',
          )}
        />
        {canReveal ? (
          <img
            src={coverUrl}
            alt=""
            draggable={false}
            className={cn(
              'absolute inset-0 h-full w-full object-cover transition-opacity duration-500',
              active ? 'opacity-100' : 'opacity-0',
            )}
          />
        ) : null}
      </div>
    </div>
  );
}
