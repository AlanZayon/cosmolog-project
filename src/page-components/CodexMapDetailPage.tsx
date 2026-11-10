'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { ApiError, getMapPins, listMaps, putMapPins } from '@/lib/api';
import type { ApiMap, ApiMapPin } from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CodexShell } from '@/components/codex/CodexShell';
import { useCodexUniverse } from '@/hooks/useCodexUniverse';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type DraftPin = {
  label: string;
  x_norm: number;
  y_norm: number;
  entry_id?: string | null;
};

export default function CodexMapDetailPage() {
  const params = useParams<{ id: string; mapId: string }>();
  const universeId = params?.id;
  const mapId = params?.mapId;
  const { t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const { universe, loading: universeLoading, isOwner } = useCodexUniverse(universeId);
  const owner = isOwner(user?.id);

  const [map, setMap] = useState<ApiMap | null>(null);
  const [pins, setPins] = useState<DraftPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pinLabel, setPinLabel] = useState('');

  const load = useCallback(async () => {
    if (!universeId || !mapId) return;
    setLoading(true);
    try {
      const maps = await listMaps(universeId);
      const m = maps.find((x) => x.id === mapId) ?? null;
      setMap(m);
      const pinRows = await getMapPins(mapId);
      setPins(
        pinRows.map((p) => ({
          label: p.label,
          x_norm: p.x_norm,
          y_norm: p.y_norm,
          entry_id: p.entry_id,
        })),
      );
    } catch (err) {
      toast({ title: t('common.error'), description: err instanceof ApiError ? err.message : String(err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [universeId, mapId, t, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const onMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!owner || !pinLabel.trim()) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setPins((prev) => [
      ...prev,
      { label: pinLabel.trim(), x_norm: Math.min(1, Math.max(0, x)), y_norm: Math.min(1, Math.max(0, y)) },
    ]);
    setPinLabel('');
  };

  const savePins = async () => {
    if (!mapId) return;
    setSaving(true);
    try {
      const saved = await putMapPins(mapId, pins);
      setPins(saved.map((p: ApiMapPin) => ({ label: p.label, x_norm: p.x_norm, y_norm: p.y_norm, entry_id: p.entry_id })));
      toast({ title: t('codex.pinsSaved') });
    } catch (err) {
      toast({ title: t('common.error'), description: err instanceof ApiError ? err.message : String(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <CodexShell
      universe={universe}
      loading={universeLoading}
      title={map?.title ?? t('codex.maps')}
      actions={
        owner ? (
          <Button type="button" size="sm" onClick={savePins} disabled={saving}>
            <Save className="mr-1 h-4 w-4" aria-hidden />
            {saving ? t('common.saving') : t('codex.savePins')}
          </Button>
        ) : undefined
      }
    >
      <Link href={universeId ? `/universe/${universeId}/codex/maps` : '#'} className="mb-6 inline-block text-sm text-muted-foreground hover:text-primary">
        ← {t('codex.backToMaps')}
      </Link>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : !map ? (
        <p className="text-muted-foreground">{t('codex.mapNotFound')}</p>
      ) : (
        <div className="space-y-4">
          {owner ? (
            <div className="flex flex-wrap gap-2">
              <Input
                className="max-w-xs"
                value={pinLabel}
                onChange={(e) => setPinLabel(e.target.value)}
                placeholder={t('codex.pinLabel')}
              />
              <p className="text-xs text-muted-foreground self-center">{t('codex.clickToPlacePin')}</p>
            </div>
          ) : null}
          <div
            className={cn('relative mx-auto max-w-4xl overflow-hidden rounded-xl border border-border', owner && pinLabel.trim() && 'cursor-crosshair')}
            onClick={onMapClick}
            role="presentation"
          >
            <img src={map.image_url} alt="" className="block w-full select-none" draggable={false} />
            {pins.map((pin, i) => (
              <button
                key={`${pin.label}-${i}`}
                type="button"
                className="absolute -translate-x-1/2 -translate-y-full rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground shadow"
                style={{ left: `${pin.x_norm * 100}%`, top: `${pin.y_norm * 100}%` }}
                onClick={(ev) => {
                  ev.stopPropagation();
                  if (owner) setPins((prev) => prev.filter((_, idx) => idx !== i));
                }}
              >
                {pin.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </CodexShell>
  );
}
