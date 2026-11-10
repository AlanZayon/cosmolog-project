'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { ApiError, listLoreEntries } from '@/lib/api';
import type { ApiLoreEntry } from '@/lib/api/types';
import { Input } from '@/components/ui/input';
import { CodexEntryCard, CodexShell } from '@/components/codex/CodexShell';
import { useCodexUniverse } from '@/hooks/useCodexUniverse';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/use-toast';
import { entryPagePath, KIND_LABEL_KEYS } from '@/lib/codex/sections';

export default function CodexIndexPage() {
  const params = useParams<{ id: string }>();
  const universeId = params?.id;
  const { t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const { universe, loading: universeLoading, isOwner } = useCodexUniverse(universeId);
  const owner = isOwner(user?.id);

  const [entries, setEntries] = useState<ApiLoreEntry[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!universeId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await listLoreEntries(universeId, {
          q: query.trim() || undefined,
          include_drafts: owner,
        });
        if (!cancelled) {
          setEntries(data.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })));
        }
      } catch (err) {
        if (!cancelled) {
          toast({ title: t('common.error'), description: err instanceof ApiError ? err.message : String(err), variant: 'destructive' });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [universeId, query, owner, t, toast]);

  const grouped = useMemo(() => {
    const map = new Map<string, ApiLoreEntry[]>();
    for (const entry of entries) {
      const letter = (entry.title[0] ?? '#').toUpperCase();
      const key = /[A-Z]/.test(letter) ? letter : '#';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [entries]);

  return (
    <CodexShell universe={universe} loading={universeLoading} title={t('codex.index')}>
      <Link href={universeId ? `/universe/${universeId}/codex` : '#'} className="mb-6 inline-block text-sm text-muted-foreground hover:text-primary">
        ← {t('codex.backToHub')}
      </Link>

      <div className="relative mb-8 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('codex.indexSearch')}
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : entries.length === 0 ? (
        <p className="text-muted-foreground">{t('codex.noEntries')}</p>
      ) : (
        <div className="space-y-8">
          {grouped.map(([letter, list]) => (
            <section key={letter}>
              <h2 className="mb-3 font-serif text-2xl font-bold text-muted-foreground">{letter}</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {list.map((entry) => (
                  <li key={entry.id}>
                    <CodexEntryCard
                      href={universeId ? entryPagePath(universeId, entry.slug) : '#'}
                      title={entry.title}
                      summary={entry.summary}
                      cover={entry.cover_image_url}
                      badge={t(KIND_LABEL_KEYS[entry.kind])}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </CodexShell>
  );
}
