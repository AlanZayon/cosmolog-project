'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { ApiError, createTimelineEvent, deleteTimelineEvent, listTimelineEvents } from '@/lib/api';
import type { ApiTimelineEvent } from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CodexShell } from '@/components/codex/CodexShell';
import { useCodexUniverse } from '@/hooks/useCodexUniverse';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/use-toast';

export default function CodexTimelinePage() {
  const params = useParams<{ id: string }>();
  const universeId = params?.id;
  const { t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const { universe, loading: universeLoading, isOwner } = useCodexUniverse(universeId);
  const owner = isOwner(user?.id);

  const [events, setEvents] = useState<ApiTimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!universeId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await listTimelineEvents(universeId);
        if (!cancelled) setEvents(data.sort((a, b) => a.sort_key - b.sort_key || a.title.localeCompare(b.title)));
      } catch (err) {
        if (!cancelled) {
          toast({
            title: t('common.error'),
            description: err instanceof ApiError ? err.message : String(err),
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [universeId, t, toast]);

  const addEvent = async () => {
    if (!universeId || !title.trim()) return;
    setSaving(true);
    try {
      const created = await createTimelineEvent(universeId, {
        title: title.trim(),
        summary: summary.trim() || null,
        occurred_at_label: label.trim() || null,
        sort_key: events.length,
      });
      setEvents((prev) => [...prev, created].sort((a, b) => a.sort_key - b.sort_key));
      setShowForm(false);
      setTitle('');
      setSummary('');
      setLabel('');
      toast({ title: t('codex.timelineCreated') });
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err instanceof ApiError ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const removeEvent = async (id: string) => {
    if (!window.confirm(t('codex.deleteTimelineConfirm'))) return;
    try {
      await deleteTimelineEvent(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err instanceof ApiError ? err.message : String(err),
        variant: 'destructive',
      });
    }
  };

  return (
    <CodexShell universe={universe} loading={universeLoading} title={t('codex.timeline')}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={universeId ? `/universe/${universeId}/codex` : '#'} className="text-sm text-muted-foreground hover:text-primary">
          ← {t('codex.backToHub')}
        </Link>
        {owner ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
            <Plus className="mr-1 h-4 w-4" aria-hidden />
            {t('codex.createTimeline')}
          </Button>
        ) : null}
      </div>

      {universe?.default_calendar_label ? (
        <p className="mb-6 text-sm text-muted-foreground">
          {t('codex.calendarLabel')}: {universe.default_calendar_label}
        </p>
      ) : null}

      {showForm && owner ? (
        <div className="mb-8 space-y-3 rounded-xl border border-border bg-card p-4">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('codex.timelineTitle')} />
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('codex.timelineWhen')} />
          <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} placeholder={t('codex.entrySummary')} />
          <Button type="button" size="sm" onClick={addEvent} disabled={saving || !title.trim()}>
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : events.length === 0 ? (
        <p className="text-muted-foreground">{t('codex.noTimeline')}</p>
      ) : (
        <ol className="relative border-l border-border pl-6">
          {events.map((event) => (
            <li key={event.id} className="mb-8 ml-2">
              <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-primary bg-background" aria-hidden />
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{event.title}</h3>
                  {event.occurred_at_label ? (
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{event.occurred_at_label}</p>
                  ) : null}
                  {event.summary ? <p className="mt-1 text-sm text-muted-foreground">{event.summary}</p> : null}
                </div>
                {owner ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeEvent(event.id)}>
                    {t('common.delete')}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </CodexShell>
  );
}
