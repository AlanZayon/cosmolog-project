'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Plus } from 'lucide-react';
import {
  ApiError,
  createGalleryCollection,
  getGalleryAssets,
  listGalleryCollections,
  putGalleryAssets,
} from '@/lib/api';
import type { ApiGalleryAsset, ApiGalleryCollection, GalleryArtKind } from '@/lib/api/types';
import { uploadFile } from '@/lib/api/storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CodexShell } from '@/components/codex/CodexShell';
import { useCodexUniverse } from '@/hooks/useCodexUniverse';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/use-toast';

type CollectionWithAssets = ApiGalleryCollection & { assets: ApiGalleryAsset[] };

export default function CodexGalleryPage() {
  const params = useParams<{ id: string }>();
  const universeId = params?.id;
  const { t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const { universe, loading: universeLoading, isOwner } = useCodexUniverse(universeId);
  const owner = isOwner(user?.id);

  const [collections, setCollections] = useState<CollectionWithAssets[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [assetCollectionId, setAssetCollectionId] = useState<string | null>(null);
  const [artKind, setArtKind] = useState<GalleryArtKind>('final');
  const [caption, setCaption] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = async () => {
    if (!universeId) return;
    const cols = await listGalleryCollections(universeId);
    const withAssets = await Promise.all(
      cols.map(async (c) => ({
        ...c,
        assets: await getGalleryAssets(c.id),
      })),
    );
    setCollections(withAssets);
  };

  useEffect(() => {
    if (!universeId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await reload();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universeId]);

  const addCollection = async () => {
    if (!universeId || !title.trim()) return;
    setSaving(true);
    try {
      await createGalleryCollection(universeId, {
        title: title.trim(),
        description: description.trim() || null,
      });
      await reload();
      setShowForm(false);
      setTitle('');
      setDescription('');
      toast({ title: t('codex.galleryCreated') });
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

  const addAsset = async (file: File) => {
    if (!user || !assetCollectionId) return;
    setSaving(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const image_url = await uploadFile('codex-gallery', file, path);
      const existing = collections.find((c) => c.id === assetCollectionId)?.assets ?? [];
      await putGalleryAssets(assetCollectionId, [
        ...existing.map((a, i) => ({
          image_url: a.image_url,
          caption: a.caption,
          art_kind: a.art_kind,
          entry_id: a.entry_id,
          sort_key: i,
        })),
        {
          image_url,
          caption: caption.trim() || null,
          art_kind: artKind,
          sort_key: existing.length,
        },
      ]);
      await reload();
      setCaption('');
      setAssetCollectionId(null);
      toast({ title: t('codex.galleryAssetAdded') });
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err instanceof ApiError ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <CodexShell universe={universe} loading={universeLoading} title={t('codex.gallery')}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={universeId ? `/universe/${universeId}/codex` : '#'}
          className="text-sm text-muted-foreground hover:text-primary"
        >
          ← {t('codex.backToHub')}
        </Link>
        {owner ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
            <Plus className="mr-1 h-4 w-4" aria-hidden />
            {t('codex.createGallery')}
          </Button>
        ) : null}
      </div>

      {showForm && owner ? (
        <div className="mb-8 space-y-3 rounded-xl border border-border bg-card p-4">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('codex.galleryTitle')}
          />
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder={t('codex.entrySummary')}
          />
          <Button type="button" size="sm" onClick={addCollection} disabled={saving || !title.trim()}>
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void addAsset(file);
        }}
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : collections.length === 0 ? (
        <p className="text-muted-foreground">{t('codex.noGallery')}</p>
      ) : (
        <div className="space-y-10">
          {collections.map((col) => (
            <section key={col.id}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-serif text-xl font-semibold">{col.title}</h2>
                  {col.description ? <p className="text-sm text-muted-foreground">{col.description}</p> : null}
                </div>
                {owner ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
                      value={assetCollectionId === col.id ? artKind : 'final'}
                      onChange={(e) => {
                        setAssetCollectionId(col.id);
                        setArtKind(e.target.value as GalleryArtKind);
                      }}
                    >
                      <option value="final">final</option>
                      <option value="sketch">sketch</option>
                      <option value="map">map</option>
                      <option value="diagram">diagram</option>
                    </select>
                    <Input
                      className="h-9 max-w-[10rem]"
                      value={assetCollectionId === col.id ? caption : ''}
                      onChange={(e) => {
                        setAssetCollectionId(col.id);
                        setCaption(e.target.value);
                      }}
                      placeholder={t('codex.galleryCaption')}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAssetCollectionId(col.id);
                        fileRef.current?.click();
                      }}
                      disabled={saving}
                    >
                      <ImagePlus className="mr-1 h-4 w-4" aria-hidden />
                      {t('codex.addGalleryAsset')}
                    </Button>
                  </div>
                ) : null}
              </div>
              {col.assets.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('codex.noGalleryAssets')}</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {col.assets.map((asset) => (
                    <figure key={asset.id} className="overflow-hidden rounded-lg border border-border bg-card">
                      <img
                        src={asset.image_url}
                        alt={asset.caption ?? ''}
                        className="aspect-square w-full object-cover"
                      />
                      <figcaption className="space-y-0.5 p-2 text-xs text-muted-foreground">
                        <span className="uppercase tracking-wide">{asset.art_kind}</span>
                        {asset.caption ? <p>{asset.caption}</p> : null}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </CodexShell>
  );
}
