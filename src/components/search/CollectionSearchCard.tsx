'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/use-toast';
import {
  saveLibraryCollection,
  unsaveLibraryCollection,
  type ApiLibraryCollectionSummary,
} from '@/lib/api/library';
import { LibraryCollectionIcon } from '@/lib/libraryIcons';
import { Loader2 } from 'lucide-react';

type CollectionSearchCardProps = {
  collection: ApiLibraryCollectionSummary;
  returnTo: string;
  onSavedChange?: (collectionId: string, saved: boolean) => void;
};

export default function CollectionSearchCard({
  collection,
  returnTo,
  onSavedChange,
}: CollectionSearchCardProps) {
  const { user } = useAuth();
  const { t, tf } = useLanguage();
  const { toast } = useToast();
  const [saved, setSaved] = useState(collection.is_saved_by_me);
  const [loading, setLoading] = useState(false);

  const handleToggleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (saved) {
        await unsaveLibraryCollection(collection.id);
        setSaved(false);
        onSavedChange?.(collection.id, false);
        toast({ title: t('library.collectionUnsaved') });
      } else {
        await saveLibraryCollection(collection.id);
        setSaved(true);
        onSavedChange?.(collection.id, true);
        toast({ title: t('library.collectionSavedToShelf') });
      }
    } catch {
      toast({ title: t('library.saveError'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border">
        <LibraryCollectionIcon icon={collection.icon} className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold truncate">{collection.name}</p>
        {collection.owner_username ? (
          <p className="text-sm text-muted-foreground">@{collection.owner_username}</p>
        ) : null}
        {collection.description ? (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{collection.description}</p>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">
          {tf('library.storyCount', { n: collection.item_count })}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/library?collection=${collection.id}&returnTo=${encodeURIComponent(returnTo)}`}
            >
              {t('library.viewCollection')}
            </Link>
          </Button>
          {user ? (
            <Button
              type="button"
              variant={saved ? 'secondary' : 'default'}
              size="sm"
              disabled={loading}
              onClick={() => void handleToggleSave()}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : saved ? (
                t('library.removeFromShelf')
              ) : (
                t('library.saveCollectionToShelf')
              )}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
