import type { TranslationKey } from '@/i18n/translations';
import type { IllustratedBlockItem } from '@/components/IllustratedBlockEditor';
import { blockHasContent, totalTextChars } from '@/lib/storyBlocks';

/** Hard caps for titles, descriptions and long-form text — enforced before save across the app. */
export const CONTENT_LIMITS = {
  /** One-line style titles in cards and headers */
  universeTitle: 90,
  arcName: 90,
  storyTitle: 90,
  chapterTitle: 90,
  /** Blurb / synopsis length (feed, detail intro) — not chapter body */
  universeDescription: 1_200,
  arcDescription: 1_200,
  storyDescription: 1_200,
  /** Whole short story body only — book chapters have no cap */
  storyShortBody: 500_000,
  /** Short story block caps */
  shortStoryMaxBlocks: 50,
  shortStoryMaxImages: 30,
} as const;

export type CharLimitViolation = {
  labelKey: TranslationKey;
  length: number;
  max: number;
};

function pushIfOver(
  out: CharLimitViolation[],
  value: string,
  max: number,
  labelKey: TranslationKey,
) {
  const len = value.length;
  if (len > max) out.push({ labelKey, length: len, max });
}

export function validateUniverseFields(title: string, description: string): CharLimitViolation[] {
  const v: CharLimitViolation[] = [];
  pushIfOver(v, title, CONTENT_LIMITS.universeTitle, 'createUniverse.nameLabel');
  pushIfOver(v, description, CONTENT_LIMITS.universeDescription, 'createUniverse.descLabel');
  return v;
}

export function validateArcFields(name: string, description: string): CharLimitViolation[] {
  const v: CharLimitViolation[] = [];
  pushIfOver(v, name, CONTENT_LIMITS.arcName, 'universe.arcName');
  pushIfOver(v, description, CONTENT_LIMITS.arcDescription, 'universe.arcDescription');
  return v;
}

export function validateStoryMeta(title: string, description: string): CharLimitViolation[] {
  const v: CharLimitViolation[] = [];
  pushIfOver(v, title, CONTENT_LIMITS.storyTitle, 'story.title');
  pushIfOver(v, description, CONTENT_LIMITS.storyDescription, 'story.description');
  return v;
}

export function validateStoryShortBody(content: string): CharLimitViolation[] {
  const v: CharLimitViolation[] = [];
  pushIfOver(v, content, CONTENT_LIMITS.storyShortBody, 'createStory.contentLabel');
  return v;
}

export function validateShortStoryBlocks(blocks: IllustratedBlockItem[]): CharLimitViolation[] {
  const v: CharLimitViolation[] = [];
  const filled = blocks.filter(blockHasContent);
  const textChars = totalTextChars(filled);
  if (textChars > CONTENT_LIMITS.storyShortBody) {
    v.push({
      labelKey: 'createStory.contentLabel',
      length: textChars,
      max: CONTENT_LIMITS.storyShortBody,
    });
  }
  if (filled.length > CONTENT_LIMITS.shortStoryMaxBlocks) {
    v.push({
      labelKey: 'validation.shortStoryMaxBlocks',
      length: filled.length,
      max: CONTENT_LIMITS.shortStoryMaxBlocks,
    });
  }
  const imageCount = filled.filter((b) => b.block_type === 'image').length;
  if (imageCount > CONTENT_LIMITS.shortStoryMaxImages) {
    v.push({
      labelKey: 'validation.shortStoryMaxImages',
      length: imageCount,
      max: CONTENT_LIMITS.shortStoryMaxImages,
    });
  }
  return v;
}

export function shortStoryBlocksEmpty(blocks: IllustratedBlockItem[]): boolean {
  return !blocks.some(blockHasContent);
}

export function validateChapterTitle(title: string): CharLimitViolation[] {
  const v: CharLimitViolation[] = [];
  pushIfOver(v, title, CONTENT_LIMITS.chapterTitle, 'story.chapterTitlePlaceholder');
  return v;
}

export function formatViolationLine(t: (k: TranslationKey) => string, v: CharLimitViolation): string {
  return t('validation.charLimitExceeded')
    .replace(/\{\{field\}\}/g, t(v.labelKey))
    .replace(/\{\{max\}\}/g, String(v.max))
    .replace(/\{\{current\}\}/g, String(v.length));
}

export function describeViolations(t: (k: TranslationKey) => string, violations: CharLimitViolation[]): string {
  return violations.map((x) => formatViolationLine(t, x)).join('\n');
}
