import { useState, useRef } from 'react';
import { ImagePlus, X, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/useLanguage';

interface ComicPageItem {
  id?: string;
  file?: File;
  preview: string;
  image_url?: string;
}

interface ComicPageUploaderProps {
  pages: ComicPageItem[];
  onChange: (pages: ComicPageItem[]) => void;
}

export default function ComicPageUploader({ pages, onChange }: ComicPageUploaderProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter(f => {
      if (f.size > 5 * 1024 * 1024) {
        toast({ title: `${f.name} - ${t('story.imageTooLarge')}`, description: t('story.max5mb'), variant: 'destructive' });
        return false;
      }
      return true;
    });

    const newPages: ComicPageItem[] = valid.map(f => ({
      file: f,
      preview: URL.createObjectURL(f),
    }));

    onChange([...pages, ...newPages]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePage = (index: number) => {
    const page = pages[index];
    if (page.file) URL.revokeObjectURL(page.preview);
    onChange(pages.filter((_, i) => i !== index));
  };

  const movePage = (from: number, to: number) => {
    if (to < 0 || to >= pages.length) return;
    const arr = [...pages];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    onChange(arr);
  };

  return (
    <div className="space-y-3">
      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFiles} className="hidden" />

      {pages.length > 0 && (
        <div className="space-y-2">
          {pages.map((page, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card">
              <div className="flex flex-col gap-1">
                <button type="button" onClick={() => movePage(i, i - 1)} disabled={i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <GripVertical className="h-3 w-3 rotate-180" />
                </button>
                <button type="button" onClick={() => movePage(i, i + 1)} disabled={i === pages.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <GripVertical className="h-3 w-3" />
                </button>
              </div>
              <div className="w-16 h-16 rounded overflow-hidden border border-border shrink-0">
                <img src={page.preview || page.image_url} alt={`${t('story.page')} ${i + 1}`} className="w-full h-full object-cover" />
              </div>
              <span className="text-sm text-muted-foreground flex-1">{t('story.page')} {i + 1}</span>
              <button type="button" onClick={() => removePage(i)} className="p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full">
        <ImagePlus className="h-4 w-4 mr-2" /> {t('comic.addPages')}
      </Button>
    </div>
  );
}
