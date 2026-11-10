import { useCallback, useEffect, useState } from 'react';
import { ApiError, getUniverseById } from '@/lib/api';
import type { ApiUniverse } from '@/lib/api/types';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/useLanguage';

export function useCodexUniverse(universeId: string | undefined) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [universe, setUniverse] = useState<ApiUniverse | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!universeId) {
      setUniverse(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getUniverseById(universeId);
      setUniverse(data);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err);
      toast({ title: t('common.error'), description: message, variant: 'destructive' });
      setUniverse(null);
    } finally {
      setLoading(false);
    }
  }, [universeId, t, toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { universe, loading, refresh, isOwner: (userId: string | undefined) => Boolean(userId && universe && userId === universe.owner_id) };
}
