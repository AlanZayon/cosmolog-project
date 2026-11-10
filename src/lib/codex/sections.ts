import type { LoreEntryKind } from '@/lib/api/types';
import type { TranslationKey } from '@/i18n/translations';

export const LORE_ENTRY_KINDS: LoreEntryKind[] = [
  'episode',
  'era',
  'event',
  'faction',
  'institution',
  'social_class',
  'place',
  'creature',
  'system',
  'glossary_term',
  'vehicle',
  'character',
  'drama_synopsis',
  'side_tale',
  'meta_essay',
  'custom',
];

export const KIND_LABEL_KEYS: Record<LoreEntryKind, TranslationKey> = {
  episode: 'codex.kind.episode',
  era: 'codex.kind.era',
  event: 'codex.kind.event',
  faction: 'codex.kind.faction',
  institution: 'codex.kind.institution',
  social_class: 'codex.kind.social_class',
  place: 'codex.kind.place',
  creature: 'codex.kind.creature',
  system: 'codex.kind.system',
  glossary_term: 'codex.kind.glossary_term',
  vehicle: 'codex.kind.vehicle',
  character: 'codex.kind.character',
  drama_synopsis: 'codex.kind.drama_synopsis',
  side_tale: 'codex.kind.side_tale',
  meta_essay: 'codex.kind.meta_essay',
  custom: 'codex.kind.custom',
};

export type CodexHubSection = {
  id: string;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  href?: (universeId: string) => string;
  kindHrefs?: { kind: LoreEntryKind; universeId: string }[];
};

export const CODEX_HUB_SECTIONS: CodexHubSection[] = [
  {
    id: 'cover',
    labelKey: 'codex.section.cover',
    descriptionKey: 'codex.section.coverDesc',
    kindHrefs: [{ kind: 'episode', universeId: '' }],
  },
  {
    id: 'history',
    labelKey: 'codex.section.history',
    descriptionKey: 'codex.section.historyDesc',
    href: (id) => `/universe/${id}/codex/timeline`,
    kindHrefs: [
      { kind: 'era', universeId: '' },
      { kind: 'event', universeId: '' },
    ],
  },
  {
    id: 'society',
    labelKey: 'codex.section.society',
    descriptionKey: 'codex.section.societyDesc',
    kindHrefs: [
      { kind: 'faction', universeId: '' },
      { kind: 'institution', universeId: '' },
      { kind: 'social_class', universeId: '' },
    ],
  },
  {
    id: 'geography',
    labelKey: 'codex.section.geography',
    descriptionKey: 'codex.section.geographyDesc',
    href: (id) => `/universe/${id}/codex/maps`,
    kindHrefs: [{ kind: 'place', universeId: '' }],
  },
  {
    id: 'bestiary',
    labelKey: 'codex.section.bestiary',
    descriptionKey: 'codex.section.bestiaryDesc',
    kindHrefs: [{ kind: 'creature', universeId: '' }],
  },
  {
    id: 'science',
    labelKey: 'codex.section.science',
    descriptionKey: 'codex.section.scienceDesc',
    kindHrefs: [{ kind: 'system', universeId: '' }],
  },
  {
    id: 'glossary',
    labelKey: 'codex.section.glossary',
    descriptionKey: 'codex.section.glossaryDesc',
    kindHrefs: [{ kind: 'glossary_term', universeId: '' }],
  },
  {
    id: 'vehicles',
    labelKey: 'codex.section.vehicles',
    descriptionKey: 'codex.section.vehiclesDesc',
    kindHrefs: [{ kind: 'vehicle', universeId: '' }],
  },
  {
    id: 'characters',
    labelKey: 'codex.section.characters',
    descriptionKey: 'codex.section.charactersDesc',
    kindHrefs: [{ kind: 'character', universeId: '' }],
  },
  {
    id: 'drama',
    labelKey: 'codex.section.drama',
    descriptionKey: 'codex.section.dramaDesc',
    kindHrefs: [
      { kind: 'drama_synopsis', universeId: '' },
      { kind: 'side_tale', universeId: '' },
    ],
  },
  {
    id: 'gallery',
    labelKey: 'codex.section.gallery',
    descriptionKey: 'codex.section.galleryDesc',
    href: (id) => `/universe/${id}/codex/gallery`,
  },
  {
    id: 'index',
    labelKey: 'codex.section.index',
    descriptionKey: 'codex.section.indexDesc',
    href: (id) => `/universe/${id}/codex/index`,
  },
  {
    id: 'toc',
    labelKey: 'codex.section.toc',
    descriptionKey: 'codex.section.tocDesc',
    href: (id) => `/universe/${id}/codex/toc`,
  },
  {
    id: 'meta',
    labelKey: 'codex.section.meta',
    descriptionKey: 'codex.section.metaDesc',
    kindHrefs: [{ kind: 'meta_essay', universeId: '' }],
  },
];

export function kindPagePath(universeId: string, kind: LoreEntryKind) {
  return `/universe/${universeId}/codex/${kind}`;
}

export function entryPagePath(universeId: string, slug: string) {
  return `/universe/${universeId}/codex/entry/${encodeURIComponent(slug)}`;
}

export function slugifyTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'entry';
}

export function isLoreEntryKind(value: string): value is LoreEntryKind {
  return (LORE_ENTRY_KINDS as string[]).includes(value);
}
