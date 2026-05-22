import type { IllustratedBlockItem } from '@/components/IllustratedBlockEditor';
import { getBlocks, replaceBlocks } from '@/lib/api/content';
import { uploadFile } from '@/lib/api/storage';
import type { Tables } from '@/integrations/supabase/types';

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
  const data = await getBlocks(storyId, chapterId ?? null);
  return data as StoryBlockRow[];
}

export async function uploadBlockImage(
  token: string,
  userId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split('.').pop();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  return uploadFile(token, 'comics', file, path);
}

export async function saveBlocks(
  storyId: string,
  chapterId: string | null,
  blocks: IllustratedBlockItem[],
  token: string,
  userId: string,
): Promise<void> {
  const payload: { block_type: string; content: string }[] = [];

  for (const block of blocks) {
    if (!blockHasContent(block)) continue;
    let content = block.content;
    if (block.block_type === 'image' && block.file) {
      content = await uploadBlockImage(token, userId, block.file);
    }
    payload.push({ block_type: block.block_type, content: content.trim() });
  }

  await replaceBlocks(token, storyId, payload, chapterId ?? undefined);
}
