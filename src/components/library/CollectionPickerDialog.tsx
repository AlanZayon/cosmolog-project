"use client";

import { useEffect, useMemo, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog';
import CollectionFormDialog, { type CollectionFormValues } from '@/components/library/CollectionFormDialog';
import LibrarySearchInput from '@/components/library/LibrarySearchInput';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/use-toast';
import {
  addStoryToCollection,
  createLibraryCollection,
  removeStoryFromCollection,
  type ApiLibraryStatusCollection,
} from '@/lib/api/library';
import { LibraryCollectionIcon } from '@/lib/libraryIcons';
import { filterLibraryCollections } from '@/lib/libraryCollectionSearch';
import { cn } from '@/lib/utils';
import { Bookmark, Check, FolderPlus, Loader2, Plus, X } from 'lucide-react';

const COLLECTION_PICKER_OPEN_ATTR = 'data-collection-picker-open';

interface CollectionPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storyId: string;
  collections: ApiLibraryStatusCollection[];
  onCollectionsChange: (collections: ApiLibraryStatusCollection[]) => void;
}

function handlePickerOpenChange(onOpenChange: (open: boolean) => void, open: boolean) {
  if (open) {
    document.body.setAttribute(COLLECTION_PICKER_OPEN_ATTR, 'true');
  } else {
    document.body.removeAttribute(COLLECTION_PICKER_OPEN_ATTR);
    document.body.style.pointerEvents = 'none';
    window.setTimeout(() => {
      document.body.style.pointerEvents = '';
    }, 300);
  }
  onOpenChange(open);
}

export function isCollectionPickerOpen() {
  return document.body.hasAttribute(COLLECTION_PICKER_OPEN_ATTR);
}

function CollectionPickerItem({
  collection,
  toggling,
  onToggle,
}: {
  collection: ApiLibraryStatusCollection;
  toggling: boolean;
  onToggle: () => void;
}) {
  const selected = collection.contains_story;

  return (
    <button
      type="button"
      disabled={toggling}
      onClick={onToggle}
      className={cn(
        'group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all',
        'hover:border-primary/30 hover:bg-accent/40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        selected
          ? 'border-primary/50 bg-primary/5 shadow-sm'
          : 'border-border/80 bg-card/50',
        toggling && 'opacity-70',
      )}
      aria-pressed={selected}
    >
      <div
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors',
          selected
            ? 'border-primary/30 bg-primary/10 text-primary'
            : 'border-border/80 bg-muted/40 text-muted-foreground group-hover:text-foreground',
        )}
      >
        <LibraryCollectionIcon icon={collection.icon} className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium leading-tight text-foreground">{collection.name}</p>
        {collection.description ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{collection.description}</p>
        ) : null}
      </div>

      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-all',
          selected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border/80 bg-background text-transparent group-hover:border-muted-foreground/30',
        )}
        aria-hidden
      >
        {toggling ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : (
          <Check className={cn('h-3.5 w-3.5', selected ? 'opacity-100' : 'opacity-0')} />
        )}
      </div>
    </button>
  );
}

export default function CollectionPickerDialog({
  open,
  onOpenChange,
  storyId,
  collections,
  onCollectionsChange,
}: CollectionPickerDialogProps) {
  const { t, tf } = useLanguage();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCollections = useMemo(
    () => filterLibraryCollections(collections, searchQuery),
    [collections, searchQuery],
  );

  const searchActive = searchQuery.trim().length > 0;
  const savedCount = collections.filter((c) => c.contains_story).length;

  useEffect(() => {
    if (!open) {
      setCreateDialogOpen(false);
      setCreating(false);
      setTogglingId(null);
      setSearchQuery('');
      document.body.removeAttribute(COLLECTION_PICKER_OPEN_ATTR);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      document.body.removeAttribute(COLLECTION_PICKER_OPEN_ATTR);
    };
  }, []);

  const setCollectionMembership = async (collectionId: string, shouldContain: boolean) => {
    const current = collections.find((c) => c.id === collectionId);
    if (!current || current.contains_story === shouldContain) return;

    const prev = collections;
    const next = collections.map((c) =>
      c.id === collectionId ? { ...c, contains_story: shouldContain } : c,
    );
    onCollectionsChange(next);
    setTogglingId(collectionId);

    try {
      if (shouldContain) {
        await addStoryToCollection(collectionId, storyId);
        toast({ title: t('library.storySaved') });
      } else {
        await removeStoryFromCollection(collectionId, storyId);
      }
    } catch {
      onCollectionsChange(prev);
      toast({ title: t('library.saveError'), variant: 'destructive' });
    } finally {
      setTogglingId(null);
    }
  };

  const handleCreate = async (values: CollectionFormValues) => {
    setCreating(true);
    try {
      const created = await createLibraryCollection({
        name: values.name,
        description: values.description || null,
        icon: values.icon,
      });
      await addStoryToCollection(created.id, storyId);
      onCollectionsChange([
        {
          id: created.id,
          name: created.name,
          icon: created.icon,
          description: created.description,
          contains_story: true,
        },
        ...collections,
      ]);
      setCreateDialogOpen(false);
      toast({ title: t('library.storySaved') });
    } catch {
      toast({ title: t('library.saveError'), variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => handlePickerOpenChange(onOpenChange, next)}>
      <DialogPortal>
        <DialogOverlay className="z-[110] bg-background/70 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-[50%] top-[50%] z-[110] w-[calc(100%-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%]',
            'overflow-hidden rounded-2xl border border-border/80 bg-background shadow-2xl duration-200',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          )}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <div className="gradient-hero px-6 pb-5 pt-6 text-primary-foreground">
            <DialogHeader className="space-y-2 text-left">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15 backdrop-blur-sm">
                    <Bookmark className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="font-serif text-xl font-semibold tracking-tight text-primary-foreground">
                      {t('library.saveToShelf')}
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-sm text-primary-foreground/80">
                      {t('library.saveToShelfHint')}
                    </DialogDescription>
                  </div>
                </div>
                <DialogPrimitive.Close className="rounded-lg p-1.5 text-primary-foreground/80 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-primary-foreground/30">
                  <X className="h-4 w-4" />
                  <span className="sr-only">{t('common.close')}</span>
                </DialogPrimitive.Close>
              </div>
            </DialogHeader>
          </div>

          <div className="space-y-4 px-6 py-5">
            <button
              type="button"
              onClick={() => setCreateDialogOpen(true)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border border-dashed border-border/90 p-3 text-left transition-colors',
                'hover:border-primary/40 hover:bg-accent/30',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              )}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-muted/30 text-muted-foreground">
                <FolderPlus className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{t('library.pickerCreateNew')}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t('library.pickerCreateNewHint')}</p>
              </div>
              <Plus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>

            {collections.length === 0 ? (
              <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-8 text-center">
                <p className="text-sm font-medium text-foreground">{t('library.emptyCollections')}</p>
                <p className="mt-1.5 text-sm text-muted-foreground">{t('library.emptyCollectionsHint')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('library.pickerYourCollections')}
                </p>
                <LibrarySearchInput
                  id="collection-picker-search"
                  value={searchQuery}
                  onChange={setSearchQuery}
                  label={t('library.searchCollections')}
                  placeholder={t('library.searchCollectionsPlaceholder')}
                  className="max-w-none"
                />
                {filteredCollections.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    {t('library.noCollectionSearchResults')}
                  </p>
                ) : (
                  <ul className="max-h-[min(18rem,45vh)] space-y-2 overflow-y-auto pr-0.5 [-webkit-overflow-scrolling:touch]">
                    {filteredCollections.map((collection) => (
                      <li key={collection.id}>
                        <CollectionPickerItem
                          collection={collection}
                          toggling={togglingId === collection.id}
                          onToggle={() =>
                            void setCollectionMembership(collection.id, !collection.contains_story)
                          }
                        />
                      </li>
                    ))}
                  </ul>
                )}
                {searchActive && filteredCollections.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {tf('library.collectionSearchResultsCount', {
                      n: filteredCollections.length,
                      total: collections.length,
                    })}
                  </p>
                ) : null}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-6 py-4">
            <p className="text-xs text-muted-foreground">
              {savedCount > 0
                ? tf('library.pickerSavedIn', { n: savedCount })
                : t('library.pickerNotSavedYet')}
            </p>
            <Button type="button" size="sm" onClick={() => handlePickerOpenChange(onOpenChange, false)}>
              {t('library.pickerDone')}
            </Button>
          </div>

          <CollectionFormDialog
            open={createDialogOpen}
            onOpenChange={setCreateDialogOpen}
            mode="create"
            submitting={creating}
            onSubmit={handleCreate}
          />
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
