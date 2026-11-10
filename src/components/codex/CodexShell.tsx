import Link from 'next/link';
import Header from '@/components/Header';
import PreviousScreenBackButton from '@/components/PreviousScreenBackButton';
import { CodexModeToggle } from '@/components/codex/CodexModeToggle';
import type { ApiUniverse } from '@/lib/api/types';
import { useLanguage } from '@/hooks/useLanguage';

type CodexShellProps = {
  universe: ApiUniverse | null;
  loading?: boolean;
  children: React.ReactNode;
  title?: string;
  actions?: React.ReactNode;
};

export function CodexShell({ universe, loading, children, title, actions }: CodexShellProps) {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container max-w-6xl py-8 max-sm:py-6 animate-fade-in">
        <PreviousScreenBackButton className="-mt-1 mb-4" />
        {universe ? (
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('codex.subtitle')}</p>
              <h1 className="font-serif text-2xl font-bold leading-tight sm:text-3xl">
                {title ?? universe.title}
              </h1>
              <CodexModeToggle universeId={universe.id} mode="codex" codexEnabled={universe.codex_enabled ?? true} />
            </div>
            {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
          </div>
        ) : loading ? (
          <p className="mb-8 text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : (
          <p className="mb-8 text-muted-foreground">{t('universe.notFound')}</p>
        )}
        {children}
      </main>
    </div>
  );
}

export function CodexEntryCard({
  href,
  title,
  summary,
  cover,
  badge,
}: {
  href: string;
  title: string;
  summary?: string | null;
  cover?: string | null;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-muted/30"
    >
      {cover ? (
        <img src={cover} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
          —
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <h3 className="font-medium leading-snug group-hover:text-primary">{title}</h3>
          {badge ? (
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              {badge}
            </span>
          ) : null}
        </div>
        {summary ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{summary}</p> : null}
      </div>
    </Link>
  );
}
