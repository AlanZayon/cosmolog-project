import type { IllustratedBlockItem } from '@/components/IllustratedBlockEditor';
import { putLoreBlocks, type LoreBlockInput } from '@/lib/api/codex';
import type { ApiLoreBlock } from '@/lib/api/types';
import { blockHasContent, uploadBlockImage } from '@/lib/storyBlocks';

export function loreBlocksToEditorItems(rows: ApiLoreBlock[]): IllustratedBlockItem[] {
  return rows
    .slice()
    .sort((a, b) => a.block_order - b.block_order)
    .map((b) => ({
      id: b.id,
      block_type: b.block_type,
      content: b.content,
      preview: b.block_type === 'image' ? b.content : undefined,
    }));
}

export async function saveLoreBlocks(entryId: string, blocks: IllustratedBlockItem[], userId: string): Promise<void> {
  const payload: LoreBlockInput[] = [];
  let order = 0;
  for (const block of blocks) {
    if (!blockHasContent(block)) continue;
    let content = block.content;
    if (block.block_type === 'image' && block.file) {
      content = await uploadBlockImage(userId, block.file);
    }
    payload.push({
      block_type: block.block_type,
      content: content.trim(),
      block_order: order++,
    });
  }
  await putLoreBlocks(entryId, payload);
}
