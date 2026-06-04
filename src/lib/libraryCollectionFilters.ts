import type { ApiLibraryCollectionSummary } from '@/lib/api/library';

export type CollectionSortOrder = 'recent' | 'oldest';
export type CollectionVisibilityFilter = 'all' | 'public' | 'private';
export type CollectionOriginFilter = 'all' | 'mine' | 'others';

export type CollectionListFilters = {
  sort: CollectionSortOrder;
  visibility: CollectionVisibilityFilter;
  origin: CollectionOriginFilter;
};

export const DEFAULT_COLLECTION_LIST_FILTERS: CollectionListFilters = {
  sort: 'recent',
  visibility: 'all',
  origin: 'all',
};

function sortTimestamp(collection: ApiLibraryCollectionSummary): string {
  if (collection.ownership === 'saved' && collection.saved_at) {
    return collection.saved_at;
  }
  return collection.updated_at;
}

export function filterAndSortLibraryCollections(
  collections: ApiLibraryCollectionSummary[],
  filters: CollectionListFilters,
): ApiLibraryCollectionSummary[] {
  let result = collections;

  if (filters.origin === 'mine') {
    result = result.filter((c) => c.ownership === 'owned');
  } else if (filters.origin === 'others') {
    result = result.filter((c) => c.ownership === 'saved');
  }

  if (filters.visibility !== 'all') {
    result = result.filter(
      (c) => c.ownership === 'owned' && c.visibility === filters.visibility,
    );
  }

  const sorted = [...result].sort((a, b) => {
    const ta = new Date(sortTimestamp(a)).getTime();
    const tb = new Date(sortTimestamp(b)).getTime();
    return filters.sort === 'recent' ? tb - ta : ta - tb;
  });

  return sorted;
}
