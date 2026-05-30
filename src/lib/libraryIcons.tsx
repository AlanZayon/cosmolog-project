import type { TranslationKey } from '@/i18n/translations';
import {
  Bookmark,
  BookOpen,
  Coffee,
  Compass,
  Crown,
  Flame,
  FolderOpen,
  Gem,
  Globe,
  Heart,
  Library,
  Moon,
  Music,
  Palette,
  Rocket,
  Sparkles,
  Star,
  Sun,
  type LucideIcon,
} from 'lucide-react';

export const LIBRARY_COLLECTION_ICONS = [
  'folder',
  'bookmark',
  'heart',
  'star',
  'book-open',
  'library',
  'sparkles',
  'moon',
  'sun',
  'flame',
  'compass',
  'globe',
  'music',
  'palette',
  'rocket',
  'crown',
  'gem',
  'coffee',
] as const;

export type LibraryCollectionIconId = (typeof LIBRARY_COLLECTION_ICONS)[number];

export const DEFAULT_LIBRARY_COLLECTION_ICON: LibraryCollectionIconId = 'folder';

export const LIBRARY_DESCRIPTION_MAX_LENGTH = 280;

export const LIBRARY_ICON_LABEL_KEYS: Record<LibraryCollectionIconId, TranslationKey> = {
  folder: 'library.icon.folder',
  bookmark: 'library.icon.bookmark',
  heart: 'library.icon.heart',
  star: 'library.icon.star',
  'book-open': 'library.icon.bookOpen',
  library: 'library.icon.library',
  sparkles: 'library.icon.sparkles',
  moon: 'library.icon.moon',
  sun: 'library.icon.sun',
  flame: 'library.icon.flame',
  compass: 'library.icon.compass',
  globe: 'library.icon.globe',
  music: 'library.icon.music',
  palette: 'library.icon.palette',
  rocket: 'library.icon.rocket',
  crown: 'library.icon.crown',
  gem: 'library.icon.gem',
  coffee: 'library.icon.coffee',
};

const ICON_COMPONENTS: Record<LibraryCollectionIconId, LucideIcon> = {
  folder: FolderOpen,
  bookmark: Bookmark,
  heart: Heart,
  star: Star,
  'book-open': BookOpen,
  library: Library,
  sparkles: Sparkles,
  moon: Moon,
  sun: Sun,
  flame: Flame,
  compass: Compass,
  globe: Globe,
  music: Music,
  palette: Palette,
  rocket: Rocket,
  crown: Crown,
  gem: Gem,
  coffee: Coffee,
};

export function isLibraryCollectionIconId(value: string): value is LibraryCollectionIconId {
  return (LIBRARY_COLLECTION_ICONS as readonly string[]).includes(value);
}

export function resolveLibraryCollectionIconId(value: string | null | undefined): LibraryCollectionIconId {
  if (value && isLibraryCollectionIconId(value)) {
    return value;
  }
  return DEFAULT_LIBRARY_COLLECTION_ICON;
}

export function libraryIconLabelKey(icon: string | null | undefined): TranslationKey {
  const id = resolveLibraryCollectionIconId(icon);
  return LIBRARY_ICON_LABEL_KEYS[id];
}

export function LibraryCollectionIcon({
  icon,
  className,
}: {
  icon: string | null | undefined;
  className?: string;
}) {
  const Icon = ICON_COMPONENTS[resolveLibraryCollectionIconId(icon)];
  return <Icon className={className} aria-hidden />;
}
