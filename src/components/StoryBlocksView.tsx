import type { StoryBlockRow } from '@/lib/storyBlocks';
import { useLanguage } from '@/hooks/useLanguage';

interface StoryBlocksViewProps {
  blocks: StoryBlockRow[];
  className?: string;
}

export default function StoryBlocksView({ blocks, className = '' }: StoryBlocksViewProps) {
  const { t } = useLanguage();

  if (blocks.length === 0) return null;

  return (
    <div className={`space-y-6 ${className}`}>
      {blocks.map((block, i) => (
        <div key={block.id || i}>
          {block.block_type === 'text' ? (
            <div className="prose prose-sm max-w-none font-serif leading-relaxed text-foreground/90 whitespace-pre-wrap">
              {block.content}
            </div>
          ) : (
            <div className="rounded-lg overflow-hidden border border-border">
              <img
                src={block.content}
                alt={`${t('story.illustration')} ${i + 1}`}
                className="w-full object-contain"
                loading="lazy"
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
