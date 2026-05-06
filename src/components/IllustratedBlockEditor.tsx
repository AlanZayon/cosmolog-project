import { useRef } from 'react';
import { ImagePlus, Type, X, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/useLanguage';

export interface IllustratedBlockItem {
  id?: string;
  block_type: 'text' | 'image';
  content: string;
  file?: File;
  preview?: string;
}

interface IllustratedBlockEditorProps {
  blocks: IllustratedBlockItem[];
  onChange: (blocks: IllustratedBlockItem[]) => void;
}

export default function IllustratedBlockEditor({ blocks, onChange }: IllustratedBlockEditorProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingInsertIndex = useRef<number>(-1);

  const addTextBlock = () => {
    onChange([...blocks, { block_type: 'text', content: '' }]);
  };

  const addImageBlock = () => {
    pendingInsertIndex.current = blocks.length;
    fileInputRef.current?.click();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: t('story.imageTooLarge'), description: t('story.max5mb'), variant: 'destructive' });
      return;
    }
    const preview = URL.createObjectURL(file);
    const newBlocks = [...blocks];
    newBlocks.splice(pendingInsertIndex.current, 0, {
      block_type: 'image',
      content: '',
      file,
      preview,
    });
    onChange(newBlocks);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateBlock = (index: number, content: string) => {
    const updated = [...blocks];
    updated[index] = { ...updated[index], content };
    onChange(updated);
  };

  const removeBlock = (index: number) => {
    const block = blocks[index];
    if (block.preview) URL.revokeObjectURL(block.preview);
    onChange(blocks.filter((_, i) => i !== index));
  };

  const moveBlock = (from: number, to: number) => {
    if (to < 0 || to >= blocks.length) return;
    const arr = [...blocks];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    onChange(arr);
  };

  return (
    <div className="space-y-3">
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

      {blocks.map((block, i) => (
        <div key={i} className="flex gap-2 p-2 rounded-lg border border-border bg-card">
          <div className="flex flex-col gap-1 pt-1">
            <button type="button" onClick={() => moveBlock(i, i - 1)} disabled={i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
              <GripVertical className="h-3 w-3 rotate-180" />
            </button>
            <button type="button" onClick={() => moveBlock(i, i + 1)} disabled={i === blocks.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
              <GripVertical className="h-3 w-3" />
            </button>
          </div>
          <div className="flex-1">
            {block.block_type === 'text' ? (
              <Textarea
                value={block.content}
                onChange={e => updateBlock(i, e.target.value)}
                placeholder={t('illustrated.writePlaceholder')}
                rows={3}
                className="text-sm"
              />
            ) : (
              <div className="w-full max-w-xs rounded overflow-hidden border border-border">
                <img src={block.preview || block.content} alt={`Block ${i + 1}`} className="w-full object-contain" />
              </div>
            )}
          </div>
          <button type="button" onClick={() => removeBlock(i)} className="p-1 h-fit rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addTextBlock}>
          <Type className="h-4 w-4 mr-1" /> {t('illustrated.text')}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={addImageBlock}>
          <ImagePlus className="h-4 w-4 mr-1" /> {t('illustrated.image')}
        </Button>
      </div>
    </div>
  );
}
