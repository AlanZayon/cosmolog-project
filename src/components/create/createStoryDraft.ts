import type { IllustratedBlockItem } from '@/components/IllustratedBlockEditor';
import type { ReadingMode } from '@/components/ReadingModeField';
import type { StoryFeedPreviewData, StoryWithProfile } from '@/components/feed/StoryFeedPreviewView';
import { blockHasContent, type StoryBlockRow } from '@/lib/storyBlocks';
import type { Tables } from '@/integrations/supabase/types';

export type CreateStoryType = 'short_story' | 'chapters' | 'comic';

export type DraftChapter = { title: string; blocks: IllustratedBlockItem[] };

export type CreateStoryDraftInput = {
  storyType: CreateStoryType;
  title: string;
  description: string;
  tags: string[];
  coverPreview: string | null;
  readingMode: ReadingMode;
  authorUsername: string | null;
  universe: { id: string; title: string } | null;
  arc: { id: string; name: string } | null;
  shortStoryBlocks: IllustratedBlockItem[];
  draftChapters: DraftChapter[];
  comicPages: { file?: File; preview: string }[];
};

function draftBlocksToRows(
  blocks: IllustratedBlockItem[],
  storyId: string,
  chapterId: string | null,
): StoryBlockRow[] {
  return blocks.filter(blockHasContent).map((block, i) => {
    const content =
      block.block_type === 'image'
        ? block.preview || block.content || ''
        : block.content;
    return {
      id: block.id || `draft-block-${chapterId ?? 'root'}-${i}`,
      story_id: storyId,
      chapter_id: chapterId,
      block_type: block.block_type,
      content,
      block_order: i + 1,
      created_at: new Date(0).toISOString(),
    };
  });
}

export function buildCreateStoryPreviewData(input: CreateStoryDraftInput): StoryFeedPreviewData {
  const storyId = 'draft-preview';
  const now = new Date(0).toISOString();

  const story: StoryWithProfile = {
    id: storyId,
    author_id: 'draft-author',
    title: input.title.trim() || '—',
    description: input.description.trim() || null,
    cover_image_url: input.coverPreview,
    feed_display_mode: 'preview',
    reading_mode: input.readingMode,
    content: null,
    type: input.storyType,
    universe_id: input.universe?.id ?? null,
    arc_id: input.arc?.id ?? null,
    tags: input.tags.length > 0 ? input.tags : null,
    likes_count: 0,
    comments_count: 0,
    created_at: now,
    updated_at: now,
    profiles: input.authorUsername ? { username: input.authorUsername } : null,
    universe: input.universe,
    arc: input.arc,
  };

  if (input.storyType === 'short_story') {
    return {
      story,
      chapters: [],
      comicPages: [],
      shortStoryBlocks: draftBlocksToRows(input.shortStoryBlocks, storyId, null),
      chapterBlocksMap: {},
    };
  }

  if (input.storyType === 'chapters') {
    const chapters: Tables<'chapters'>[] = [];
    const chapterBlocksMap: Record<string, StoryBlockRow[]> = {};

    input.draftChapters.forEach((ch, i) => {
      const title = ch.title.trim();
      const hasContent = ch.blocks.some(blockHasContent);
      if (!title && !hasContent) return;
      const id = `draft-chapter-${i}`;
      chapters.push({
        id,
        story_id: storyId,
        title: title || '—',
        content: '',
        chapter_number: chapters.length + 1,
        created_at: now,
        updated_at: now,
      });
      chapterBlocksMap[id] = draftBlocksToRows(ch.blocks, storyId, id);
    });

    return {
      story,
      chapters,
      comicPages: [],
      shortStoryBlocks: [],
      chapterBlocksMap,
    };
  }

  return {
    story,
    chapters: [],
    comicPages: input.comicPages.map((page, i) => ({
      id: `draft-page-${i}`,
      image_url: page.preview,
      page_order: i + 1,
    })),
    shortStoryBlocks: [],
    chapterBlocksMap: {},
  };
}
