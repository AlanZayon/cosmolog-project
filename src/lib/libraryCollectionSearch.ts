type SearchableCollection = {
  name: string;
  description?: string | null;
};

export function filterLibraryCollections<T extends SearchableCollection>(
  collections: T[],
  query: string,
): T[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return collections;

  return collections.filter((collection) => {
    const haystack = [collection.name, collection.description ?? ''].join(' ').toLowerCase();
    return haystack.includes(normalized);
  });
}
