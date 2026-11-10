'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Plus, Save } from 'lucide-react';
import {
  ApiError,
  getCodexToc,
  getLoreEntryById,
  listLoreEntries,
  putCodexToc,
} from '@/lib/api';
import type { ApiCodexTocItem, ApiLoreEntry, CodexTocHrefKind } from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CodexShell } from '@/components/codex/CodexShell';
import { useCodexUniverse } from '@/hooks/useCodexUniverse';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/use-toast';
import { entryPagePath, isLoreEntryKind, kindPagePath } from '@/lib/codex/sections';

type DraftTocItem = {
  title: string;
  section_key: string;
  entry_id: string;
  href_kind: CodexTocHrefKind | '';
  sort_key: number;
};

function tocHref(universeId: string, item: ApiCodexTocItem, entrySlugById: Map<string, string>): string {
  switch (item.href_kind) {
    case 'cover':
      return `/universe/${universeId}/codex`;
    case 'timeline':
      return `/universe/${universeId}/codex/timeline`;
    case 'gallery':
      return `/universe/${universeId}/codex/gallery`;
    case 'index':
      return `/universe/${universeId}/codex/index`;
    case 'maps':
      return `/universe/${universeId}/codex/maps`;
    case 'kind':
      return item.section_key && isLoreEntryKind(item.section_key)
        ? kindPagePath(universeId, item.section_key)
        : `/universe/${universeId}/codex`;
    case 'entry':
      if (item.entry_id) {
        const slug = entrySlugById.get(item.entry_id);
        if (slug) return entryPagePath(universeId, slug);
      }
      return `/universe/${universeId}/codex`;
    default:
      if (item.entry_id) {
        const slug = entrySlugById.get(item.entry_id);
        if (slug) return entryPagePath(universeId, slug);
      }
      return `/universe/${universeId}/codex`;
  }
}

export default function CodexTocPage() {
  const params = useParams<{ id: string }>();
  const universeId = params?.id;
  const { t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const { universe, loading: universeLoading, isOwner } = useCodexUniverse(universeId);
  const owner = isOwner(user?.id);

  const [items, setItems] = useState<ApiCodexTocItem[]>([]);
  const [entries, setEntries] = useState<ApiLoreEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<DraftTocItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [readerIndex, setReaderIndex] = useState(0);

  const entrySlugById = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of entries) map.set(e.id, e.slug);
    return map;
  }, [entries]);

  const load = async () => {
    if (!universeId) return;
    setLoading(true);
    try {
      const [toc, lore] = await Promise.all([
        getCodexToc(universeId),
        listLoreEntries(universeId, { include_drafts: owner }),
      ]);
      setItems(toc);
      setEntries(lore);
      setDrafts(
        toc.map((item) => ({
          title: item.title,
          section_key: item.section_key ?? '',
          entry_id: item.entry_id ?? '',
          href_kind: (item.href_kind ?? '') as CodexTocHrefKind | '',
          sort_key: item.sort_key,
        })),
      );
      setReaderIndex(0);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err);
      toast({ title: t('common.error'), description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universeId, owner]);

  const saveToc = async () => {
    if (!universeId) return;
    setSaving(true);
    try {
      const payload = drafts.map((d, i) => ({
        title: d.title.trim() || t('codex.tocUntitled'),
        section_key: d.section_key.trim() || null,
        entry_id: d.entry_id.trim() || null,
        href_kind: (d.href_kind || null) as CodexTocHrefKind | null,
        sort_key: i,
      }));
      const saved = await putCodexToc(universeId, payload);
      setItems(saved);
      setEditing(false);
      toast({ title: t('codex.tocSaved') });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err);
      toast({ title: t('common.error'), description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const current = items[readerIndex] ?? null;
  const prev = readerIndex > 0 ? items[readerIndex - 1] : null;
  const next = readerIndex < items.length - 1 ? items[readerIndex + 1] : null;

  const [previewEntry, setPreviewEntry] = useState<ApiLoreEntry | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!current?.entry_id) {
        setPreviewEntry(null);
        return;
      }
      try {
        const e = await getLoreEntryById(current.entry_id);
        if (!cancelled) setPreviewEntry(e);
      } catch {
        if (!cancelled) setPreviewEntry(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [current?.entry_id]);

  const actions = owner ? (
    editing ? (
      <Button type="button" size="sm" onClick={saveToc} disabled={saving}>
        <Save className="mr-1 h-4 w-4" aria-hidden />
        {saving ? t('common.saving') : t('common.save')}
      </Button>
    ) : (
      <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
        {t('codex.editToc')}
      </Button>
    )
  ) : undefined;

  return (
    <CodexShell universe={universe} loading={universeLoading} title={t('codex.toc')} actions={actions}>
      <Link href={universeId ? `/universe/${universeId}/codex` : '#'} className="mb-6 inline-block text-sm text-muted-foreground hover:text-primary">
        ← {t('codex.backToHub')}
      </Link>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : editing && owner ? (
        <div className="space-y-4">
          {drafts.map((draft, index) => (
            <div key={index} className="grid gap-2 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
              <Input
                value={draft.title}
                onChange={(e) => {
                  const nextDrafts = [...drafts];
                  nextDrafts[index] = { ...draft, title: e.target.value };
                  setDrafts(nextDrafts);
                }}
                placeholder={t('codex.tocItemTitle')}
              />
              <select
                className="h-10 rounded-lg border border-input bg-background px-2 text-sm"
                value={draft.href_kind}
                onChange={(e) => {
                  const nextDrafts = [...drafts];
                  nextDrafts[index] = { ...draft, href_kind: e.target.value as CodexTocHrefKind | '' };
                  setDrafts(nextDrafts);
                }}
              >
                <option value="">{t('codex.tocHrefNone')}</option>
                <option value="cover">cover</option>
                <option value="timeline">timeline</option>
                <option value="maps">maps</option>
                <option value="gallery">gallery</option>
                <option value="index">index</option>
                <option value="kind">kind</option>
                <option value="entry">entry</option>
              </select>
              <Input
                value={draft.section_key}
                onChange={(e) => {
                  const nextDrafts = [...drafts];
                  nextDrafts[index] = { ...draft, section_key: e.target.value };
                  setDrafts(nextDrafts);
                }}
                placeholder={t('codex.tocSectionKey')}
              />
              <select
                className="h-10 rounded-lg border border-input bg-background px-2 text-sm"
                value={draft.entry_id}
                onChange={(e) => {
                  const nextDrafts = [...drafts];
                  nextDrafts[index] = { ...draft, entry_id: e.target.value };
                  setDrafts(nextDrafts);
                }}
              >
                <option value="">{t('codex.tocNoEntry')}</option>
                {entries.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="sm:col-span-2"
                onClick={() => setDrafts(drafts.filter((_, i) => i !== index))}
              >
                {t('common.delete')}
              </Button>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setDrafts([
                ...drafts,
                { title: '', section_key: '', entry_id: '', href_kind: 'cover', sort_key: drafts.length },
              ])
            }
          >
            <Plus className="mr-1 h-4 w-4" aria-hidden />
            {t('codex.addTocItem')}
          </Button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground">{t('codex.noToc')}</p>
      ) : (
        <div className="space-y-8">
          <ol className="space-y-2">
            {items.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setReaderIndex(index)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    index === readerIndex
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <span className="w-8 shrink-0 font-mono text-xs text-muted-foreground">{index + 1}</span>
                  <span className="font-medium">{item.title}</span>
                </button>
              </li>
            ))}
          </ol>

          {current ? (
            <section className="rounded-2xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-2 text-muted-foreground">
                <BookOpen className="h-4 w-4" aria-hidden />
                <span className="text-xs uppercase tracking-wider">{t('codex.artbookReader')}</span>
              </div>
              <h2 className="font-serif text-2xl font-semibold">{current.title}</h2>
              {previewEntry?.summary ? (
                <p className="mt-3 text-muted-foreground">{previewEntry.summary}</p>
              ) : null}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!prev}
                  onClick={() => setReaderIndex((i) => Math.max(0, i - 1))}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
                  {prev?.title ?? t('codex.prev')}
                </Button>
                {universeId ? (
                  <Link
                    href={tocHref(universeId, current, entrySlugById)}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {t('codex.openSection')}
                  </Link>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!next}
                  onClick={() => setReaderIndex((i) => Math.min(items.length - 1, i + 1))}
                >
                  {next?.title ?? t('codex.next')}
                  <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
                </Button>
              </div>
            </section>
          ) : null}
        </div>
      )}
    </CodexShell>
  );
}
