'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Plus } from 'lucide-react';
import { ApiError, createMap, listMaps } from '@/lib/api';
import type { ApiMap } from '@/lib/api/types';
import { uploadFile } from '@/lib/api/storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CodexEntryCard, CodexShell } from '@/components/codex/CodexShell';
import { useCodexUniverse } from '@/hooks/useCodexUniverse';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/use-toast';

export default function CodexMapsPage() {
  const params = useParams<{ id: string }>();
  const universeId = params?.id;
  const { t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const { universe, loading: universeLoading, isOwner } = useCodexUniverse(universeId);
  const owner = isOwner(user?.id);

  const [maps, setMaps] = useState<ApiMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!universeId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await listMaps(universeId);
        if (!cancelled) setMaps(data);
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
  }, [universeId, t, toast]);

  const addMap = async () => {
    if (!universeId || !user || !title.trim() || !imageFile) return;
    setSaving(true);
    try {
      const ext = imageFile.name.split('.').pop();
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const image_url = await uploadFile('codex-maps', imageFile, path);
      const created = await createMap(universeId, {
        title: title.trim(),
        description: description.trim() || null,
        image_url,
      });
      setMaps((prev) => [...prev, created]);
      setShowForm(false);
      setTitle('');
      setDescription('');
      setImageFile(null);
      setPreview(null);
      toast({ title: t('codex.mapCreated') });
    } catch (err) {
      toast({ title: t('common.error'), description: err instanceof ApiError ? err.message : String(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <CodexShell universe={universe} loading={universeLoading} title={t('codex.maps')}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={universeId ? `/universe/${universeId}/codex` : '#'} className="text-sm text-muted-foreground hover:text-primary">
          ← {t('codex.backToHub')}
        </Link>
        {owner ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
            <Plus className="mr-1 h-4 w-4" aria-hidden />
            {t('codex.createMap')}
          </Button>
        ) : null}
      </div>

      {showForm && owner ? (
        <div className="mb-8 space-y-3 rounded-xl border border-border bg-card p-4">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('codex.mapTitle')} />
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setImageFile(f);
              setPreview(URL.createObjectURL(f));
            }}
          />
          {preview ? (
            <img src={preview} alt="" className="max-h-48 rounded-lg object-cover" />
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <ImagePlus className="mr-1 h-4 w-4" aria-hidden />
              {t('codex.mapImage')}
            </Button>
          )}
          <Button type="button" size="sm" onClick={addMap} disabled={saving || !title.trim() || !imageFile}>
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : maps.length === 0 ? (
        <p className="text-muted-foreground">{t('codex.noMaps')}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {maps.map((map) => (
            <li key={map.id}>
              <CodexEntryCard
                href={universeId ? `/universe/${universeId}/codex/maps/${map.id}` : '#'}
                title={map.title}
                summary={map.description}
                cover={map.image_url}
              />
            </li>
          ))}
        </ul>
      )}
    </CodexShell>
  );
}
