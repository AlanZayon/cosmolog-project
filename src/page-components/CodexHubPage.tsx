'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Download, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CodexShell } from '@/components/codex/CodexShell';
import { useCodexUniverse } from '@/hooks/useCodexUniverse';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/use-toast';
import { getCodexExportMarkdown } from '@/lib/api/codex';
import { CODEX_HUB_SECTIONS, kindPagePath, KIND_LABEL_KEYS } from '@/lib/codex/sections';
import type { LoreEntryKind } from '@/lib/api/types';

export default function CodexHubPage() {
  const params = useParams<{ id: string }>();
  const universeId = params?.id;
  const { t } = useLanguage();
  const { toast } = useToast();
  const { universe, loading } = useCodexUniverse(universeId);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!universeId) return;
    setExporting(true);
    try {
      const md = await getCodexExportMarkdown(universeId);
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${universe?.title ?? 'codex'}-export.md`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: t('codex.exportDone') });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast({ title: t('common.error'), description: message, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const exportButton = (
    <Button type="button" variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
      <Download className="mr-1.5 h-4 w-4 shrink-0" aria-hidden />
      {exporting ? t('common.loading') : t('codex.export')}
    </Button>
  );

  if (universe && !universe.codex_enabled) {
    return (
      <CodexShell universe={universe} title={t('codex.title')}>
        <p className="text-muted-foreground">{t('codex.disabled')}</p>
        <Link href={`/universe/${universe.id}`} className="mt-4 inline-block text-sm text-primary hover:underline">
          {t('codex.backToStories')}
        </Link>
      </CodexShell>
    );
  }

  return (
    <CodexShell universe={universe} loading={loading} actions={universe ? exportButton : undefined}>
      {universe?.saga_premise ? (
        <section className="mb-10 rounded-2xl border border-border bg-gradient-to-br from-card via-background to-muted/30 p-6 sm:p-8">
          <h2 className="mb-3 font-serif text-lg font-semibold">{t('codex.sagaPremise')}</h2>
          <p className="whitespace-pre-wrap text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
            {universe.saga_premise}
          </p>
        </section>
      ) : null}

      {universe?.afterword ? (
        <section className="mb-10 rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
          <h2 className="mb-2 font-medium text-foreground">{t('codex.afterword')}</h2>
          <p className="whitespace-pre-wrap">{universe.afterword}</p>
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CODEX_HUB_SECTIONS.map((section) => {
          const primaryHref = section.href && universeId ? section.href(universeId) : null;
          const kinds =
            section.kindHrefs?.map((k) => k.kind).filter(Boolean) ?? ([] as LoreEntryKind[]);

          return (
            <article
              key={section.id}
              className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/30"
            >
              <h2 className="font-serif text-lg font-semibold">{t(section.labelKey)}</h2>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">{t(section.descriptionKey)}</p>
              <div>
                {primaryHref ? (
                  <Link
                    href={primaryHref}
                    className="mt-4 inline-flex items-center text-sm font-medium text-primary hover:underline"
                  >
                    {t('codex.openSection')}
                    <ChevronRight className="ml-0.5 h-4 w-4" aria-hidden />
                  </Link>
                ) : null}
                {universeId && kinds.length > 0 ? (
                  <ul className="mt-3 space-y-1 border-t border-border pt-3">
                    {kinds.map((kind) => (
                      <li key={kind}>
                        <Link
                          href={kindPagePath(universeId, kind)}
                          className="text-sm text-muted-foreground hover:text-primary"
                        >
                          {t(KIND_LABEL_KEYS[kind])}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </CodexShell>
  );
}
