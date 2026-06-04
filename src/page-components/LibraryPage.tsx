"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import StoryCard from '@/components/StoryCard';
import CollectionFormDialog, { type CollectionFormValues } from '@/components/library/CollectionFormDialog';
import CollectionStoriesShelf from '@/components/library/CollectionStoriesShelf';
import LibrarySearchInput from '@/components/library/LibrarySearchInput';
import LibraryFiltersBar from '@/components/library/LibraryFiltersBar';
import { BrowseContentRow, browseStoryTileClass } from '@/components/browse/BrowseContentRow';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/use-toast';
import {
  createLibraryCollection,
  deleteLibraryCollection,
  getCollectionStories,
  getLibraryCollection,
  getLikedStories,
  getLibraryCollections,
  removeStoryFromCollection,
  reorderCollectionStories,
  saveLibraryCollection,
  unsaveLibraryCollection,
  updateLibraryCollection,
  type ApiLibraryCollectionSummary,
  type ApiLibraryStoryItem,
} from '@/lib/api/library';
import {
  DEFAULT_COLLECTION_LIST_FILTERS,
  filterAndSortLibraryCollections,
  type CollectionListFilters,
} from '@/lib/libraryCollectionFilters';
import {
  collectStoryFilterOptions,
  DEFAULT_STORY_LIST_FILTERS,
  filterAndSortLibraryStories,
  type StoryListFilters,
} from '@/lib/libraryStoryFilters';
import {
  LibraryCollectionIcon,
  resolveLibraryCollectionIconId,
} from '@/lib/libraryIcons';
import { filterLibraryStories } from '@/lib/libraryStorySearch';
import { filterLibraryCollections } from '@/lib/libraryCollectionSearch';
import type { Tables } from '@/integrations/supabase/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';

function toStoryCardStory(story: ApiLibraryStoryItem): Tables<'stories'> & {
  profiles?: { username: string; avatar_url: string | null } | null;
} {
  return {
    ...story,
    profiles: story.profiles ?? null,
  };
}

export default function LibraryPage() {
  const { user, loading: authLoading } = useAuth();
  const { t, tf } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [likedStories, setLikedStories] = useState<ApiLibraryStoryItem[]>([]);
  const [collections, setCollections] = useState<ApiLibraryCollectionSummary[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<ApiLibraryCollectionSummary | null>(null);
  const [collectionStories, setCollectionStories] = useState<ApiLibraryStoryItem[]>([]);
  const [collectionListFilters, setCollectionListFilters] = useState<CollectionListFilters>(
    DEFAULT_COLLECTION_LIST_FILTERS,
  );
  const [likedStoryFilters, setLikedStoryFilters] = useState<StoryListFilters>(
    DEFAULT_STORY_LIST_FILTERS,
  );
  const [collectionStoryFilters, setCollectionStoryFilters] = useState<StoryListFilters>(
    DEFAULT_STORY_LIST_FILTERS,
  );
  const [unsavingFromShelf, setUnsavingFromShelf] = useState(false);
  const [savingToShelf, setSavingToShelf] = useState(false);
  const openedFromUrlRef = useRef<string | null>(null);
  const prevCollectionIdFromUrlRef = useRef<string | null>(null);
  const [loadingLiked, setLoadingLiked] = useState(true);
  const [loadingCollections, setLoadingCollections] = useState(true);
  const [loadingCollectionStories, setLoadingCollectionStories] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [submittingCollection, setSubmittingCollection] = useState(false);
  const [deletingCollection, setDeletingCollection] = useState(false);
  const [removeMode, setRemoveMode] = useState(false);
  const [selectedForRemoval, setSelectedForRemoval] = useState<Set<string>>(() => new Set());
  const [removingStories, setRemovingStories] = useState(false);
  const [reorderingStories, setReorderingStories] = useState(false);
  const [likedSearchQuery, setLikedSearchQuery] = useState('');
  const [collectionSearchQuery, setCollectionSearchQuery] = useState('');
  const [collectionsListSearchQuery, setCollectionsListSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'liked' | 'collections'>('liked');

  const likedStoryFilterOptions = useMemo(
    () => collectStoryFilterOptions(likedStories),
    [likedStories],
  );

  const collectionStoryFilterOptions = useMemo(
    () => collectStoryFilterOptions(collectionStories),
    [collectionStories],
  );

  const sortedLikedStories = useMemo(
    () => filterAndSortLibraryStories(likedStories, likedStoryFilters),
    [likedStories, likedStoryFilters],
  );

  const sortedCollectionStories = useMemo(
    () => filterAndSortLibraryStories(collectionStories, collectionStoryFilters),
    [collectionStories, collectionStoryFilters],
  );

  const filteredLikedStories = useMemo(
    () => filterLibraryStories(sortedLikedStories, likedSearchQuery),
    [sortedLikedStories, likedSearchQuery],
  );

  const filteredCollectionStories = useMemo(
    () => filterLibraryStories(sortedCollectionStories, collectionSearchQuery),
    [sortedCollectionStories, collectionSearchQuery],
  );

  const sortedCollections = useMemo(
    () => filterAndSortLibraryCollections(collections, collectionListFilters),
    [collections, collectionListFilters],
  );

  const filteredCollections = useMemo(
    () => filterLibraryCollections(sortedCollections, collectionsListSearchQuery),
    [sortedCollections, collectionsListSearchQuery],
  );

  const collectionIdFromUrl = searchParams.get('collection');
  const returnToParam = searchParams.get('returnTo');
  const safeReturnTo =
    returnToParam?.startsWith('/') && !returnToParam.startsWith('//') ? returnToParam : null;

  const isOwnedCollection = selectedCollection?.ownership === 'owned';
  const isSavedCollection = selectedCollection?.ownership === 'saved';
  const isPublicBrowse = selectedCollection?.ownership === 'public';

  const pendingExternalCollection =
    Boolean(collectionIdFromUrl) && selectedCollection?.id !== collectionIdFromUrl;

  const collectionSearchActive = collectionSearchQuery.trim().length > 0;
  const collectionsListSearchActive = collectionsListSearchQuery.trim().length > 0;

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    void fetchLiked();
    void fetchCollections();
  }, [user, authLoading, router]);

  const fetchLiked = async () => {
    setLoadingLiked(true);
    try {
      setLikedStories(await getLikedStories());
    } catch {
      setLikedStories([]);
    } finally {
      setLoadingLiked(false);
    }
  };

  const fetchCollections = async () => {
    setLoadingCollections(true);
    try {
      setCollections(await getLibraryCollections());
    } catch {
      setCollections([]);
    } finally {
      setLoadingCollections(false);
    }
  };

  const loadCollectionStories = async (collectionId: string) => {
    setLoadingCollectionStories(true);
    try {
      setCollectionStories(await getCollectionStories(collectionId));
    } catch {
      setCollectionStories([]);
    } finally {
      setLoadingCollectionStories(false);
    }
  };

  const exitRemoveMode = () => {
    setRemoveMode(false);
    setSelectedForRemoval(new Set());
  };

  const clearCollectionDetail = () => {
    setSelectedCollection(null);
    setCollectionStories([]);
    setCollectionSearchQuery('');
    exitRemoveMode();
  };

  const openCollection = async (collection: ApiLibraryCollectionSummary) => {
    setActiveTab('collections');
    setSelectedCollection(collection);
    exitRemoveMode();
    setCollectionSearchQuery('');
    setCollectionStoryFilters(DEFAULT_STORY_LIST_FILTERS);
    await loadCollectionStories(collection.id);
  };

  useEffect(() => {
    if (!collectionIdFromUrl) {
      if (prevCollectionIdFromUrlRef.current != null) {
        clearCollectionDetail();
        setActiveTab('liked');
      }
      openedFromUrlRef.current = null;
      prevCollectionIdFromUrlRef.current = null;
      return;
    }

    prevCollectionIdFromUrlRef.current = collectionIdFromUrl;
    if (
      openedFromUrlRef.current &&
      openedFromUrlRef.current !== collectionIdFromUrl
    ) {
      openedFromUrlRef.current = null;
    }
    if (authLoading || !user) return;
    if (openedFromUrlRef.current === collectionIdFromUrl) return;
    if (selectedCollection?.id === collectionIdFromUrl) {
      openedFromUrlRef.current = collectionIdFromUrl;
      return;
    }

    setActiveTab('collections');
    openedFromUrlRef.current = collectionIdFromUrl;

    void (async () => {
      const fromList = collections.find((c) => c.id === collectionIdFromUrl);
      try {
        if (fromList) {
          await openCollection(fromList);
        } else {
          const summary = await getLibraryCollection(collectionIdFromUrl);
          await openCollection(summary);
        }
      } catch {
        openedFromUrlRef.current = null;
        toast({ title: t('library.saveError'), variant: 'destructive' });
        if (safeReturnTo) {
          router.push(safeReturnTo);
        }
      }
    })();
  }, [collectionIdFromUrl, authLoading, user, selectedCollection?.id, collections, safeReturnTo, router, toast, t]);

  const backToCollectionsList = () => {
    openedFromUrlRef.current = null;
    clearCollectionDetail();
    setActiveTab('collections');
    void fetchCollections();
  };

  const handleBackFromCollection = () => {
    openedFromUrlRef.current = null;
    clearCollectionDetail();
    if (safeReturnTo) {
      router.push(safeReturnTo);
      return;
    }
    setActiveTab('collections');
    void fetchCollections();
  };

  const toggleStorySelection = (storyId: string) => {
    setSelectedForRemoval((prev) => {
      const next = new Set(prev);
      if (next.has(storyId)) next.delete(storyId);
      else next.add(storyId);
      return next;
    });
  };

  const handleCreateCollection = async (values: CollectionFormValues) => {
    setSubmittingCollection(true);
    try {
      const created = await createLibraryCollection({
        name: values.name,
        description: values.description || null,
        icon: values.icon,
        visibility: values.visibility,
      });
      setCollections((prev) => [
        {
          ...created,
          item_count: 0,
          ownership: 'owned',
          owner_username: null,
          saved_at: null,
          is_saved_by_me: false,
        },
        ...prev,
      ]);
      setCreateDialogOpen(false);
      toast({ title: t('library.createCollection') });
    } catch {
      toast({ title: t('library.saveError'), variant: 'destructive' });
    } finally {
      setSubmittingCollection(false);
    }
  };

  const handleEditCollection = async (values: CollectionFormValues) => {
    if (!selectedCollection) return;

    setSubmittingCollection(true);
    try {
      const updated = await updateLibraryCollection(selectedCollection.id, {
        name: values.name,
        description: values.description || null,
        icon: values.icon,
        visibility: values.visibility,
      });
      const next = { ...selectedCollection, ...updated, item_count: selectedCollection.item_count };
      setSelectedCollection(next);
      setCollections((prev) => prev.map((c) => (c.id === next.id ? { ...c, ...updated } : c)));
      setEditDialogOpen(false);
      toast({ title: t('library.collectionUpdated') });
    } catch {
      toast({ title: t('library.saveError'), variant: 'destructive' });
    } finally {
      setSubmittingCollection(false);
    }
  };

  const handleDeleteCollection = async () => {
    if (!selectedCollection) return;

    setDeletingCollection(true);
    try {
      await deleteLibraryCollection(selectedCollection.id);
      setCollections((prev) => prev.filter((c) => c.id !== selectedCollection.id));
      setSelectedCollection(null);
      setCollectionStories([]);
      setActiveTab('collections');
      setDeleteDialogOpen(false);
      toast({ title: t('library.collectionDeleted') });
    } catch {
      toast({ title: t('library.saveError'), variant: 'destructive' });
    } finally {
      setDeletingCollection(false);
    }
  };

  const handleRemoveSelectedStories = async () => {
    if (!selectedCollection || selectedForRemoval.size === 0) return;

    const idsToRemove = [...selectedForRemoval];
    const prevStories = collectionStories;
    const nextStories = collectionStories.filter((s) => !selectedForRemoval.has(s.id));

    setRemovingStories(true);
    setCollectionStories(nextStories);

    try {
      await Promise.all(
        idsToRemove.map((storyId) => removeStoryFromCollection(selectedCollection.id, storyId)),
      );
      const removedCount = idsToRemove.length;
      setSelectedCollection((prev) =>
        prev ? { ...prev, item_count: Math.max(0, prev.item_count - removedCount) } : prev,
      );
      setCollections((prev) =>
        prev.map((c) =>
          c.id === selectedCollection.id
            ? { ...c, item_count: Math.max(0, c.item_count - removedCount) }
            : c,
        ),
      );
      exitRemoveMode();
      toast({ title: tf('library.storiesRemoved', { n: removedCount }) });
    } catch {
      setCollectionStories(prevStories);
      toast({ title: t('library.saveError'), variant: 'destructive' });
    } finally {
      setRemovingStories(false);
    }
  };

  const handleReorderStories = async (storyIds: string[]) => {
    if (!selectedCollection) return;

    const prevStories = collectionStories;
    const nextStories = storyIds
      .map((id) => collectionStories.find((s) => s.id === id))
      .filter((s): s is ApiLibraryStoryItem => s != null);

    if (nextStories.length !== collectionStories.length) return;

    setCollectionStories(nextStories);
    setReorderingStories(true);

    try {
      await reorderCollectionStories(selectedCollection.id, storyIds);
    } catch {
      setCollectionStories(prevStories);
      toast({ title: t('library.saveError'), variant: 'destructive' });
    } finally {
      setReorderingStories(false);
    }
  };

  const handleSaveToShelf = async () => {
    if (!selectedCollection) return;
    setSavingToShelf(true);
    try {
      await saveLibraryCollection(selectedCollection.id);
      const savedSummary: ApiLibraryCollectionSummary = {
        ...selectedCollection,
        ownership: 'saved',
        is_saved_by_me: true,
        saved_at: new Date().toISOString(),
      };
      setSelectedCollection(savedSummary);
      setCollections((prev) => [
        savedSummary,
        ...prev.filter((c) => c.id !== savedSummary.id),
      ]);
      toast({ title: t('library.collectionSavedToShelf') });
    } catch {
      toast({ title: t('library.saveError'), variant: 'destructive' });
    } finally {
      setSavingToShelf(false);
    }
  };

  const handleUnsaveFromShelf = async () => {
    if (!selectedCollection) return;
    setUnsavingFromShelf(true);
    try {
      await unsaveLibraryCollection(selectedCollection.id);
      setCollections((prev) => prev.filter((c) => c.id !== selectedCollection.id));
      if (safeReturnTo) {
        setSelectedCollection({
          ...selectedCollection,
          ownership: 'public',
          is_saved_by_me: false,
          saved_at: null,
        });
      } else {
        backToCollectionsList();
      }
      toast({ title: t('library.collectionUnsaved') });
    } catch {
      toast({ title: t('library.saveError'), variant: 'destructive' });
    } finally {
      setUnsavingFromShelf(false);
    }
  };

  const handleTabChange = (value: string) => {
    const tab = value as 'liked' | 'collections';
    setActiveTab(tab);
    if (tab === 'liked') {
      setSelectedCollection(null);
      setCollectionStories([]);
      setCollectionSearchQuery('');
      setCollectionsListSearchQuery('');
      exitRemoveMode();
    }
  };

  const libraryReady = !authLoading && user != null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8">
        <h1 className="text-3xl font-bold font-serif mb-6">{t('library.title')}</h1>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="liked">{t('library.liked')}</TabsTrigger>
            <TabsTrigger value="collections">{t('library.collections')}</TabsTrigger>
          </TabsList>

          <TabsContent value="liked">
            {!libraryReady || loadingLiked ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : likedStories.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center">
                <p className="font-medium">{t('library.emptyLiked')}</p>
                <p className="mt-2 text-sm text-muted-foreground">{t('library.emptyLikedHint')}</p>
                <Button asChild className="mt-4" variant="outline">
                  <Link href="/">{t('library.exploreFeed')}</Link>
                </Button>
              </div>
            ) : (
              <>
                <LibraryFiltersBar
                  mode="stories"
                  filters={likedStoryFilters}
                  onChange={setLikedStoryFilters}
                  tagOptions={likedStoryFilterOptions.tags}
                  authorOptions={likedStoryFilterOptions.authors}
                  universeOptions={likedStoryFilterOptions.universes}
                />
                <LibrarySearchInput
                  id="library-liked-story-search"
                  value={likedSearchQuery}
                  onChange={setLikedSearchQuery}
                  className="mb-6"
                />

                {filteredLikedStories.length === 0 ? (
                  <p className="text-muted-foreground">{t('library.noSearchResults')}</p>
                ) : (
                  <BrowseContentRow title={t('library.liked')}>
                    {filteredLikedStories.map((story) => (
                      <div key={story.id} className={browseStoryTileClass()}>
                        <StoryCard story={toStoryCardStory(story)} />
                      </div>
                    ))}
                  </BrowseContentRow>
                )}

                {likedSearchQuery.trim() && filteredLikedStories.length > 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {tf('library.searchResultsCount', {
                      n: filteredLikedStories.length,
                      total: likedStories.length,
                    })}
                  </p>
                ) : null}
              </>
            )}
          </TabsContent>

          <TabsContent value="collections">
            {!libraryReady ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : pendingExternalCollection ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : selectedCollection ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mb-4 -ml-2"
                  onClick={handleBackFromCollection}
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  {safeReturnTo ? t('common.back') : t('library.backToCollections')}
                </Button>

                <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-card">
                      <LibraryCollectionIcon
                        icon={selectedCollection.icon}
                        className="h-6 w-6 text-muted-foreground"
                      />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-2xl font-bold font-serif">{selectedCollection.name}</h2>
                      {selectedCollection.owner_username && !isOwnedCollection ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {tf('library.collectionByOwner', {
                            username: selectedCollection.owner_username,
                          })}
                        </p>
                      ) : null}
                      {selectedCollection.description ? (
                        <p className="mt-1 text-sm text-muted-foreground">{selectedCollection.description}</p>
                      ) : null}
                      {isSavedCollection || isPublicBrowse ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {t('library.readOnlyCollectionHint')}
                        </p>
                      ) : null}
                      <p className="mt-2 text-sm text-muted-foreground">
                        {tf('library.storyCount', { n: collectionStories.length })}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isOwnedCollection ? (
                      <>
                        <Button type="button" variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
                          <Pencil className="h-4 w-4 mr-1" />
                          {t('library.editCollection')}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteDialogOpen(true)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          {t('library.deleteCollection')}
                        </Button>
                      </>
                    ) : isSavedCollection ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={unsavingFromShelf}
                        onClick={() => void handleUnsaveFromShelf()}
                      >
                        {unsavingFromShelf ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          t('library.removeFromShelf')
                        )}
                      </Button>
                    ) : isPublicBrowse ? (
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        disabled={savingToShelf}
                        onClick={() => void handleSaveToShelf()}
                      >
                        {savingToShelf ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          t('library.saveCollectionToShelf')
                        )}
                      </Button>
                    ) : null}
                  </div>
                </div>

                {loadingCollectionStories ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : collectionStories.length === 0 ? (
                  <p className="text-muted-foreground">{t('library.emptyCollectionsHint')}</p>
                ) : (
                  <>
                    <LibraryFiltersBar
                      mode="stories"
                      filters={collectionStoryFilters}
                      onChange={setCollectionStoryFilters}
                      tagOptions={collectionStoryFilterOptions.tags}
                      authorOptions={collectionStoryFilterOptions.authors}
                      universeOptions={collectionStoryFilterOptions.universes}
                    />
                    <LibrarySearchInput
                      id="library-collection-story-search"
                      value={collectionSearchQuery}
                      onChange={setCollectionSearchQuery}
                      className="mb-6"
                    />

                    {filteredCollectionStories.length === 0 ? (
                      <p className="text-muted-foreground">{t('library.noSearchResults')}</p>
                    ) : (
                      <BrowseContentRow
                        title={t('library.collectionStories')}
                        description={
                          removeMode
                            ? t('library.removeStoriesHint')
                            : collectionSearchActive
                              ? t('library.searchActiveHint')
                              : isOwnedCollection
                                ? t('library.reorderHint')
                                : undefined
                        }
                        actions={
                          !isOwnedCollection ? null : removeMode ? (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={exitRemoveMode}
                                disabled={removingStories}
                              >
                                {t('library.cancel')}
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                disabled={removingStories || selectedForRemoval.size === 0}
                                onClick={() => void handleRemoveSelectedStories()}
                              >
                                {removingStories ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  tf('library.removeSelected', { n: selectedForRemoval.size })
                                )}
                              </Button>
                            </>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setRemoveMode(true)}
                              disabled={reorderingStories}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              {t('library.removeStories')}
                            </Button>
                          )
                        }
                      >
                        <CollectionStoriesShelf
                          stories={filteredCollectionStories}
                          removeMode={removeMode && isOwnedCollection}
                          selectedIds={selectedForRemoval}
                          onToggleSelect={toggleStorySelection}
                          onReorder={(storyIds) => void handleReorderStories(storyIds)}
                          dragLabel={t('library.dragToReorder')}
                          reorderEnabled={isOwnedCollection && !collectionSearchActive}
                        />
                      </BrowseContentRow>
                    )}

                    {collectionSearchActive && filteredCollectionStories.length > 0 ? (
                      <p className="mt-3 text-sm text-muted-foreground">
                        {tf('library.searchResultsCount', {
                          n: filteredCollectionStories.length,
                          total: collectionStories.length,
                        })}
                      </p>
                    ) : null}
                  </>
                )}
              </>
            ) : (
              <>
                <div className="mb-6 flex flex-wrap items-center gap-4">
                  <Button type="button" onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    {t('library.createCollection')}
                  </Button>
                </div>

                {loadingCollections ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : collections.length === 0 ? (
                  <div className="rounded-xl border border-border bg-card p-8 text-center">
                    <p className="font-medium">{t('library.emptyCollections')}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{t('library.emptyCollectionsHint')}</p>
                  </div>
                ) : (
                  <>
                    <LibraryFiltersBar
                      mode="collections"
                      filters={collectionListFilters}
                      onChange={setCollectionListFilters}
                    />
                    <LibrarySearchInput
                      id="library-collections-search"
                      value={collectionsListSearchQuery}
                      onChange={setCollectionsListSearchQuery}
                      label={t('library.searchCollections')}
                      placeholder={t('library.searchCollectionsPlaceholder')}
                      className="mb-6"
                    />

                    {filteredCollections.length === 0 ? (
                      <p className="text-muted-foreground">{t('library.noCollectionSearchResults')}</p>
                    ) : (
                      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {filteredCollections.map((collection) => (
                          <li key={collection.id}>
                            <button
                              type="button"
                              onClick={() => void openCollection(collection)}
                              className="flex w-full items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent"
                            >
                              <LibraryCollectionIcon
                                icon={collection.icon}
                                className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
                              />
                              <div className="min-w-0">
                                <p className="font-semibold truncate">{collection.name}</p>
                                {collection.ownership === 'saved' && collection.owner_username ? (
                                  <p className="text-xs text-muted-foreground">
                                    {tf('library.collectionByOwner', {
                                      username: collection.owner_username,
                                    })}
                                  </p>
                                ) : collection.ownership === 'owned' ? (
                                  <p className="text-xs text-muted-foreground">
                                    {collection.visibility === 'public'
                                      ? t('library.visibilityPublic')
                                      : t('library.visibilityPrivate')}
                                  </p>
                                ) : null}
                                {collection.description ? (
                                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                                    {collection.description}
                                  </p>
                                ) : null}
                                <p className="mt-2 text-xs text-muted-foreground">
                                  {tf('library.storyCount', { n: collection.item_count })}
                                </p>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    {collectionsListSearchActive && filteredCollections.length > 0 ? (
                      <p className="mt-3 text-sm text-muted-foreground">
                        {tf('library.collectionSearchResultsCount', {
                          n: filteredCollections.length,
                          total: collections.length,
                        })}
                      </p>
                    ) : null}
                  </>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <CollectionFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        mode="create"
        submitting={submittingCollection}
        onSubmit={handleCreateCollection}
      />

      {selectedCollection ? (
        <>
          <CollectionFormDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            mode="edit"
            submitting={submittingCollection}
            initialValues={{
              name: selectedCollection.name,
              description: selectedCollection.description ?? '',
              icon: resolveLibraryCollectionIconId(selectedCollection.icon),
              visibility: selectedCollection.visibility,
            }}
            onSubmit={handleEditCollection}
          />

          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('library.deleteCollection')}</AlertDialogTitle>
                <AlertDialogDescription>{t('library.deleteCollectionConfirm')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deletingCollection}>{t('library.cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  disabled={deletingCollection}
                  onClick={(e) => {
                    e.preventDefault();
                    void handleDeleteCollection();
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deletingCollection ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t('library.deleteCollection')
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </div>
  );
}
