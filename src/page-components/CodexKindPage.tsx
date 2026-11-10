'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { ApiError, createLoreEntry, listLoreEntries } from '@/lib/api';
import type { ApiLoreEntry, LoreEntryKind } from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CodexEntryCard, CodexShell } from '@/components/codex/CodexShell';
import { useCodexUniverse } from '@/hooks/useCodexUniverse';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/use-toast';
import { entryPagePath, isLoreEntryKind, KIND_LABEL_KEYS, slugifyTitle } from '@/lib/codex/sections';

export default function CodexKindPage() {
  const params = useParams<{ id: string; kind: string }>();
  const universeId = params?.id;
  const kindParam = params?.kind ?? '';
  const kind = isLoreEntryKind(kindParam) ? kindParam : null;
  const { t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const { universe, loading: universeLoading, isOwner } = useCodexUniverse(universeId);
  const owner = isOwner(user?.id);

  const [entries, setEntries] = useState<ApiLoreEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [summary, setSummary] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!universeId || !kind) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await listLoreEntries(universeId, {
          kind,
          include_drafts: owner,
        });
        if (!cancelled) setEntries(data);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof ApiError ? err.message : String(err);
          toast({ title: t('common.error'), description: message, variant: 'destructive' });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [universeId, kind, owner, t, toast]);

  const pageTitle = kind ? t(KIND_LABEL_KEYS[kind]) : t('codex.title');

  const submitEntry = async () => {
    if (!universeId || !kind || !title.trim()) return;
    setSaving(true);
    try {
      const s = (slug.trim() || slugifyTitle(title)).replace(/[^a-z0-9-]/g, '-');
      const created = await createLoreEntry(universeId, {
        kind,
        slug: s,
        title: title.trim(),
        summary: summary.trim() || null,
        publish_state: 'published',
      });
      toast({ title: t('codex.entryCreated') });
      setShowForm(false);
      setTitle('');
      setSlug('');
      setSummary('');
      setEntries((prev) => [...prev, created].sort((a, b) => a.title.localeCompare(b.title)));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err);
      toast({ title: t('common.error'), description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!kind) {
    return (
      <CodexShell universe={universe} loading={universeLoading}>
        <p className="text-muted-foreground">{t('codex.invalidKind')}</p>
        {universeId ? (
          <Link href={`/universe/${universeId}/codex`} className="mt-4 text-sm text-primary hover:underline">
            {t('codex.backToHub')}
          </Link>
        ) : null}
      </CodexShell>
    );
  }

  return (
    <CodexShell universe={universe} loading={universeLoading} title={pageTitle}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={universeId ? `/universe/${universeId}/codex` : '#'} className="text-sm text-muted-foreground hover:text-primary">
          ← {t('codex.backToHub')}
        </Link>
        {owner ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
            <Plus className="mr-1 h-4 w-4" aria-hidden />
            {t('codex.createEntry')}
          </Button>
        ) : null}
      </div>

      {showForm && owner ? (
        <div className="mb-8 space-y-3 rounded-xl border border-border bg-card p-4">
          <div>
            <label className="text-sm font-medium">{t('codex.entryTitle')}</label>
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!slug) setSlug(slugifyTitle(e.target.value));
              }}
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t('codex.entrySlug')}</label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="my-entry" />
          </div>
          <div>
            <label className="text-sm font-medium">{t('codex.entrySummary')}</label>
            <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} />
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={submitEntry} disabled={saving || !title.trim()}>
              {saving ? t('common.saving') : t('common.save')}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : entries.length === 0 ? (
        <p className="text-muted-foreground">{t('codex.noEntries')}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {entries.map((entry) => (
            <li key={entry.id}>
              <CodexEntryCard
                href={universeId ? entryPagePath(universeId, entry.slug) : '#'}
                title={entry.title}
                summary={entry.summary}
                cover={entry.cover_image_url}
                badge={entry.publish_state === 'draft' ? t('codex.draft') : undefined}
              />
            </li>
          ))}
        </ul>
      )}
    </CodexShell>
  );
}
