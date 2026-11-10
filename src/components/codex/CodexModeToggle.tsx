import Link from 'next/link';
import { useLanguage } from '@/hooks/useLanguage';
import { cn } from '@/lib/utils';
import { BookOpen, ScrollText } from 'lucide-react';

type CodexModeToggleProps = {
  universeId: string;
  mode: 'stories' | 'codex';
  codexEnabled?: boolean;
  className?: string;
};

export function CodexModeToggle({ universeId, mode, codexEnabled = true, className }: CodexModeToggleProps) {
  const { t } = useLanguage();
  if (!codexEnabled) return null;

  return (
    <div
      className={cn(
        'inline-flex rounded-lg border border-border bg-muted/40 p-1 text-sm',
        className,
      )}
      role="tablist"
      aria-label={t('codex.modeToggle')}
    >
      <Link
        href={`/universe/${universeId}`}
        role="tab"
        aria-selected={mode === 'stories'}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors',
          mode === 'stories' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <BookOpen className="h-4 w-4 shrink-0" aria-hidden />
        {t('universe.stories')}
      </Link>
      <Link
        href={`/universe/${universeId}/codex`}
        role="tab"
        aria-selected={mode === 'codex'}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors',
          mode === 'codex' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <ScrollText className="h-4 w-4 shrink-0" aria-hidden />
        {t('codex.title')}
      </Link>
    </div>
  );
}
