import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import type { IllustratedBlockItem } from '@/components/IllustratedBlockEditor';

export type StoryBlockRow = Tables<'illustrated_blocks'>;

export function normalizeStoryType(type: string | null | undefined): string {
  if (!type || type === 'illustrated') return 'chapters';
  return type;
}

export function blocksFromLegacyPlainText(content: string): IllustratedBlockItem[] {
  const trimmed = content.trim();
  if (!trimmed) return [];
  return [{ block_type: 'text', content: trimmed }];
}

export function blocksToEditorItems(rows: StoryBlockRow[]): IllustratedBlockItem[] {
  return rows.map((b) => ({
    id: b.id,
    block_type: b.block_type as 'text' | 'image',
    content: b.content,
    preview: b.block_type === 'image' ? b.content : undefined,
  }));
}

export function blockHasContent(block: IllustratedBlockItem): boolean {
  if (block.block_type === 'image') {
    return Boolean(block.file || block.content?.trim());
  }
  return Boolean(block.content?.trim());
}

export function totalTextChars(blocks: IllustratedBlockItem[]): number {
  return blocks
    .filter((b) => b.block_type === 'text')
    .reduce((sum, b) => sum + b.content.length, 0);
}

export async function loadBlocks(
  storyId: string,
  chapterId?: string | null,
): Promise<StoryBlockRow[]> {
  let query = supabase
    .from('illustrated_blocks')
    .select('*')
    .eq('story_id', storyId)
    .order('block_order');

  if (chapterId === undefined || chapterId === null) {
    query = query.is('chapter_id', null);
  } else {
    query = query.eq('chapter_id', chapterId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function uploadBlockImage(
  userId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split('.').pop();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('comics').upload(path, file);
  if (error) throw error;
  return supabase.storage.from('comics').getPublicUrl(path).data.publicUrl;
}

export async function saveBlocks(
  storyId: string,
  chapterId: string | null,
  blocks: IllustratedBlockItem[],
  userId: string,
): Promise<void> {
  let deleteQuery = supabase
    .from('illustrated_blocks')
    .delete()
    .eq('story_id', storyId);

  if (chapterId === null) {
    deleteQuery = deleteQuery.is('chapter_id', null);
  } else {
    deleteQuery = deleteQuery.eq('chapter_id', chapterId);
  }

  const { error: deleteError } = await deleteQuery;
  if (deleteError) throw deleteError;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (!blockHasContent(block)) continue;

    let content = block.content;
    if (block.block_type === 'image' && block.file) {
      content = await uploadBlockImage(userId, block.file);
    }

    const { error: insertError } = await supabase.from('illustrated_blocks').insert({
      story_id: storyId,
      chapter_id: chapterId,
      block_type: block.block_type,
      content,
      block_order: i + 1,
    });
    if (insertError) throw insertError;
  }
}
