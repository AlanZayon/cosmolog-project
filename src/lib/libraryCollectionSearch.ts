type SearchableCollection = {
  name: string;
  description?: string | null;
  owner_username?: string | null;
};

export function filterLibraryCollections<T extends SearchableCollection>(
  collections: T[],
  query: string,
): T[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return collections;

  return collections.filter((collection) => {
    const haystack = [
      collection.name,
      collection.description ?? '',
      collection.owner_username ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalized);
  });
}
