'use client';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/hooks/useLanguage';
import type {
  CollectionListFilters,
  CollectionOriginFilter,
  CollectionSortOrder,
  CollectionVisibilityFilter,
} from '@/lib/libraryCollectionFilters';
import type { StoryListFilters, StorySortOrder, UniverseFilterValue } from '@/lib/libraryStoryFilters';

type CollectionFiltersBarProps = {
  mode: 'collections';
  filters: CollectionListFilters;
  onChange: (filters: CollectionListFilters) => void;
};

type StoryFiltersBarProps = {
  mode: 'stories';
  filters: StoryListFilters;
  onChange: (filters: StoryListFilters) => void;
  tagOptions: string[];
  authorOptions: string[];
  universeOptions: { id: string; title: string }[];
};

export type LibraryFiltersBarProps = CollectionFiltersBarProps | StoryFiltersBarProps;

export default function LibraryFiltersBar(props: LibraryFiltersBarProps) {
  const { t } = useLanguage();

  if (props.mode === 'collections') {
    const { filters, onChange } = props;
    return (
      <div className="mb-6 flex flex-wrap gap-4">
        <FilterSelect
          label={t('library.filterSort')}
          value={filters.sort}
          onValueChange={(sort) =>
            onChange({ ...filters, sort: sort as CollectionSortOrder })
          }
          options={[
            { value: 'recent', label: t('library.filterSortRecent') },
            { value: 'oldest', label: t('library.filterSortOldest') },
          ]}
        />
        <FilterSelect
          label={t('library.filterVisibility')}
          value={filters.visibility}
          onValueChange={(visibility) =>
            onChange({
              ...filters,
              visibility: visibility as CollectionVisibilityFilter,
            })
          }
          options={[
            { value: 'all', label: t('library.filterAll') },
            { value: 'public', label: t('library.visibilityPublic') },
            { value: 'private', label: t('library.visibilityPrivate') },
          ]}
        />
        <FilterSelect
          label={t('library.filterOrigin')}
          value={filters.origin}
          onValueChange={(origin) =>
            onChange({ ...filters, origin: origin as CollectionOriginFilter })
          }
          options={[
            { value: 'all', label: t('library.filterAll') },
            { value: 'mine', label: t('library.filterOriginMine') },
            { value: 'others', label: t('library.filterOriginOthers') },
          ]}
        />
      </div>
    );
  }

  const { filters, onChange, tagOptions, authorOptions, universeOptions } = props;

  return (
    <div className="mb-6 flex flex-wrap gap-4">
      <FilterSelect
        label={t('library.filterSort')}
        value={filters.sort}
        onValueChange={(sort) =>
          onChange({ ...filters, sort: sort as StorySortOrder })
        }
        options={[
          { value: 'recent', label: t('library.filterSortRecent') },
          { value: 'oldest', label: t('library.filterSortOldest') },
        ]}
      />
      <FilterSelect
        label={t('library.filterTag')}
        value={filters.tag}
        onValueChange={(tag) => onChange({ ...filters, tag })}
        options={[
          { value: 'all', label: t('library.filterAll') },
          ...tagOptions.map((tag) => ({ value: tag, label: tag })),
        ]}
      />
      <FilterSelect
        label={t('library.filterAuthor')}
        value={filters.author}
        onValueChange={(author) => onChange({ ...filters, author })}
        options={[
          { value: 'all', label: t('library.filterAll') },
          ...authorOptions.map((author) => ({ value: author, label: `@${author}` })),
        ]}
      />
      <FilterSelect
        label={t('library.filterUniverse')}
        value={filters.universe}
        onValueChange={(universe) =>
          onChange({ ...filters, universe: universe as UniverseFilterValue })
        }
        options={[
          { value: 'all', label: t('library.filterAll') },
          { value: 'none', label: t('library.filterUniverseNone') },
          ...universeOptions.map((u) => ({ value: u.id, label: u.title })),
        ]}
      />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex min-w-[140px] flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
