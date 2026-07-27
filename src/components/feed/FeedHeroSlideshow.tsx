"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const FRAME_MS = 700;
const LONG_PRESS_MS = 400;

interface FeedHeroSlideshowProps {
  /** Resting image (cover, or first page fallback). */
  restUrl: string;
  /** Up to 3 page URLs shown while hovering / long-pressing. */
  previewUrls: string[];
  enabled: boolean;
  onActivate: () => void;
  className?: string;
}

/**
 * Cover at rest; on hover (desktop) or press-and-hold (mobile) cycles preview
 * frames with a crossfade. Long-press does not open the story.
 */
export default function FeedHeroSlideshow({
  restUrl,
  previewUrls,
  enabled,
  onActivate,
  className,
}: FeedHeroSlideshowProps) {
  const frames = enabled && previewUrls.length > 0 ? previewUrls.slice(0, 3) : [];
  const [active, setActive] = useState(false);
  const [frameIndex, setFrameIndex] = useState(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cycleTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const suppressClick = useRef(false);

  const clearTimers = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (cycleTimer.current) {
      clearInterval(cycleTimer.current);
      cycleTimer.current = null;
    }
  }, []);

  const stopPreview = useCallback(() => {
    clearTimers();
    setActive(false);
    setFrameIndex(0);
  }, [clearTimers]);

  const startCycling = useCallback(() => {
    if (frames.length === 0) return;
    setActive(true);
    setFrameIndex(0);
    if (cycleTimer.current) clearInterval(cycleTimer.current);
    cycleTimer.current = setInterval(() => {
      setFrameIndex((i) => (i + 1) % frames.length);
    }, FRAME_MS);
  }, [frames.length]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const onPointerEnter = () => {
    if (frames.length === 0) return;
    // Hover only for fine pointers (mouse)
    if (typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches) {
      startCycling();
    }
  };

  const onPointerLeave = () => {
    stopPreview();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (frames.length === 0) return;
    if (e.pointerType === 'mouse') return;
    suppressClick.current = false;
    longPressTimer.current = setTimeout(() => {
      suppressClick.current = true;
      startCycling();
    }, LONG_PRESS_MS);
  };

  const onPointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
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
        'block w-full cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
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
        if (frames.length > 0) e.preventDefault();
      }}
    >
      <div className="relative aspect-[16/10] overflow-hidden border-b border-border bg-muted select-none">
        {/* Crossfade: keep previous under next via stacked imgs when cycling */}
        {active && frames.length > 0 ? (
          frames.map((url, i) => (
            <img
              key={url}
              src={url}
              alt=""
              draggable={false}
              className={cn(
                'absolute inset-0 h-full w-full object-cover transition-opacity duration-500',
                i === frameIndex ? 'opacity-100' : 'opacity-0',
              )}
            />
          ))
        ) : (
          <img
            src={restUrl}
            alt=""
            draggable={false}
            className="h-full w-full object-cover"
          />
        )}
      </div>
    </div>
  );
}
