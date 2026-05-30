"use client";

import { Input } from '@/components/ui/input';
import { useLanguage } from '@/hooks/useLanguage';
import { cn } from '@/lib/utils';
import { Search, X } from 'lucide-react';

interface LibrarySearchInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

export default function LibrarySearchInput({
  id,
  value,
  onChange,
  placeholder,
  label,
  className,
}: LibrarySearchInputProps) {
  const { t } = useLanguage();
  const searchLabel = label ?? t('library.searchStories');

  return (
    <div className={cn('relative w-full max-w-md', className)}>
      <label className="sr-only" htmlFor={id}>
        {searchLabel}
      </label>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        id={id}
        type="text"
        role="searchbox"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? t('library.searchStoriesPlaceholder')}
        className="h-10 pl-9 pr-9"
        autoComplete="off"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={t('library.clearSearch')}
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
