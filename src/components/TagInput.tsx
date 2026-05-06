import { useState } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/hooks/useLanguage';

const SUGGESTED_TAGS = [
  'Fantasia', 'Romance', 'Terror', 'Ficção Científica', 'Aventura',
  'Drama', 'Comédia', 'Mistério', 'Ação', 'Poesia',
  'Conto', 'Mangá', 'Quadrinhos', 'Suspense', 'Infantil',
];

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export default function TagInput({ tags, onChange }: TagInputProps) {
  const [input, setInput] = useState('');
  const { t } = useLanguage();

  const addTag = (tag: string) => {
    const tg = tag.trim();
    if (tg && !tags.includes(tg) && tags.length < 5) {
      onChange([...tags, tg]);
    }
    setInput('');
  };

  const removeTag = (tag: string) => onChange(tags.filter(tg => tg !== tag));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    }
  };

  const suggestions = SUGGESTED_TAGS.filter(tg => !tags.includes(tg));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 mb-1">
        {tags.map(tag => (
          <Badge key={tag} variant="secondary" className="gap-1 text-xs">
            {tag}
            <button type="button" onClick={() => removeTag(tag)} className="ml-0.5 hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      {tags.length < 5 && (
        <>
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('tagInput.placeholder')}
            className="text-sm"
          />
          <div className="flex flex-wrap gap-1">
            {suggestions.slice(0, 8).map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => addTag(tag)}
                className="text-xs px-2 py-0.5 rounded-full border border-border bg-muted/50 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                + {tag}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
