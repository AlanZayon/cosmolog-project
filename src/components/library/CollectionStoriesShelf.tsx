"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import StoryCard from '@/components/StoryCard';
import { browseStoryTileClass } from '@/components/browse/BrowseContentRow';
import { Checkbox } from '@/components/ui/checkbox';
import type { ApiStoryWithProfile } from '@/lib/api/types';
import type { Tables } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { GripVertical } from 'lucide-react';

type StoryCardStory = Tables<'stories'> & {
  profiles?: { username: string; avatar_url: string | null } | null;
};

interface CollectionStoriesShelfProps {
  stories: ApiStoryWithProfile[];
  removeMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (storyId: string) => void;
  onReorder: (storyIds: string[]) => void;
  dragLabel: string;
  reorderEnabled?: boolean;
}

function toStoryCardStory(story: ApiStoryWithProfile): StoryCardStory {
  return {
    ...story,
    profiles: story.profiles ?? null,
  };
}

function SortableStoryTile({
  story,
  removeMode,
  selected,
  onToggleSelect,
  dragLabel,
  reorderEnabled,
}: {
  story: ApiStoryWithProfile;
  removeMode: boolean;
  selected: boolean;
  onToggleSelect: (storyId: string) => void;
  dragLabel: string;
  reorderEnabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: story.id,
    disabled: removeMode || !reorderEnabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        browseStoryTileClass(),
        'group relative',
        isDragging && 'z-10 opacity-80',
        removeMode && 'cursor-pointer',
        removeMode && selected && 'rounded-lg ring-2 ring-destructive ring-offset-2 ring-offset-background',
      )}
      onClick={
        removeMode
          ? (e) => {
              e.preventDefault();
              onToggleSelect(story.id);
            }
          : undefined
      }
      onKeyDown={
        removeMode
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onToggleSelect(story.id);
              }
            }
          : undefined
      }
      role={removeMode ? 'button' : undefined}
      tabIndex={removeMode ? 0 : undefined}
    >
      {removeMode ? (
        <div className="pointer-events-none absolute left-2 top-2 z-10">
          <Checkbox checked={selected} aria-hidden tabIndex={-1} />
        </div>
      ) : reorderEnabled ? (
        <button
          type="button"
          className="absolute right-1 top-1 z-10 flex h-7 w-7 cursor-grab items-center justify-center rounded-md border border-border/80 bg-background/90 opacity-0 shadow-sm transition-opacity active:cursor-grabbing group-hover:opacity-100 focus:opacity-100"
          aria-label={dragLabel}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      ) : null}
      <div className={removeMode ? 'pointer-events-none' : undefined}>
        <StoryCard story={toStoryCardStory(story)} />
      </div>
    </div>
  );
}

export default function CollectionStoriesShelf({
  stories,
  removeMode,
  selectedIds,
  onToggleSelect,
  onReorder,
  dragLabel,
  reorderEnabled = true,
}: CollectionStoriesShelfProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = stories.findIndex((s) => s.id === active.id);
    const newIndex = stories.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = [...stories];
    const [moved] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, moved);
    onReorder(next.map((s) => s.id));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={stories.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
        {stories.map((story) => (
          <SortableStoryTile
            key={story.id}
            story={story}
            removeMode={removeMode}
            selected={selectedIds.has(story.id)}
            onToggleSelect={onToggleSelect}
            dragLabel={dragLabel}
            reorderEnabled={reorderEnabled}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}
