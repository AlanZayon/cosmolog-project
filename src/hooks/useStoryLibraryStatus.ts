"use client";

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  getStoryLibraryStatus,
  type ApiLibraryStatusCollection,
} from '@/lib/api/library';

export function useStoryLibraryStatus(storyId: string) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [liked, setLiked] = useState(false);
  const [collections, setCollections] = useState<ApiLibraryStatusCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setLiked(false);
      setCollections([]);
      return;
    }

    setLoading(true);
    try {
      const status = await getStoryLibraryStatus(storyId);
      setLiked(status.liked);
      setCollections(status.collections);
    } catch {
      setLiked(false);
      setCollections([]);
    } finally {
      setLoading(false);
    }
  }, [storyId, userId]);

  useEffect(() => {
    if (pickerOpen) return;
    void refresh();
  }, [pickerOpen, refresh]);

  const openPicker = useCallback(async () => {
    if (!userId) return false;
    if (!pickerOpen) {
      await refresh();
    }
    setPickerOpen(true);
    return true;
  }, [pickerOpen, refresh, userId]);

  const handlePickerOpenChange = useCallback(
    (open: boolean) => {
      setPickerOpen(open);
    },
    [],
  );

  return {
    liked,
    setLiked,
    collections,
    setCollections,
    loading,
    pickerOpen,
    openPicker,
    handlePickerOpenChange,
    refresh,
    savedInAny: collections.some((c) => c.contains_story),
  };
}
