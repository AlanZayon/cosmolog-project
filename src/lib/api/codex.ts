import { apiBaseUrl, ApiError, apiFetch } from '@/lib/api/client';
import type {
  ApiCodexTocItem,
  ApiGalleryAsset,
  ApiGalleryCollection,
  ApiLoreAppearance,
  ApiLoreBlock,
  ApiLoreEntry,
  ApiLoreRelation,
  ApiMap,
  ApiMapPin,
  ApiTimelineEvent,
  LoreEntryKind,
} from '@/lib/api/types';

export type ListLoreEntriesParams = {
  kind?: LoreEntryKind;
  q?: string;
  include_drafts?: boolean;
};

export function listLoreEntries(universeId: string, params: ListLoreEntriesParams = {}) {
  const search = new URLSearchParams();
  if (params.kind) search.set('kind', params.kind);
  if (params.q) search.set('q', params.q);
  if (params.include_drafts) search.set('include_drafts', 'true');
  const qs = search.toString();
  return apiFetch<ApiLoreEntry[]>(`/universes/${universeId}/codex/entries${qs ? `?${qs}` : ''}`);
}

export type CreateLoreEntryPayload = {
  kind: LoreEntryKind;
  slug: string;
  title: string;
  summary?: string | null;
  cover_image_url?: string | null;
  canon_status?: string;
  publish_state?: string;
  parent_entry_id?: string | null;
  sort_key?: number;
  custom_fields?: Record<string, unknown>;
};

export function createLoreEntry(universeId: string, body: CreateLoreEntryPayload) {
  return apiFetch<ApiLoreEntry>(`/universes/${universeId}/codex/entries`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getLoreEntryById(entryId: string) {
  return apiFetch<ApiLoreEntry>(`/codex/entries/${entryId}`);
}

export function getLoreEntryBySlug(universeId: string, slug: string) {
  return apiFetch<ApiLoreEntry>(`/universes/${universeId}/codex/entries/by-slug/${encodeURIComponent(slug)}`);
}

export type UpdateLoreEntryPayload = Partial<Omit<CreateLoreEntryPayload, 'kind'>>;

export function updateLoreEntry(entryId: string, body: UpdateLoreEntryPayload) {
  return apiFetch<ApiLoreEntry>(`/codex/entries/${entryId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteLoreEntry(entryId: string) {
  return apiFetch<void>(`/codex/entries/${entryId}`, { method: 'DELETE' });
}

export function getLoreBlocks(entryId: string) {
  return apiFetch<ApiLoreBlock[]>(`/codex/entries/${entryId}/blocks`);
}

export type LoreBlockInput = {
  block_type: 'text' | 'image';
  content: string;
  block_order: number;
};

export function putLoreBlocks(entryId: string, blocks: LoreBlockInput[]) {
  return apiFetch<ApiLoreBlock[]>(`/codex/entries/${entryId}/blocks`, {
    method: 'PUT',
    body: JSON.stringify({ blocks }),
  });
}

export function listLoreRelations(universeId: string) {
  return apiFetch<ApiLoreRelation[]>(`/universes/${universeId}/codex/relations`);
}

export type CreateLoreRelationPayload = {
  from_entry_id: string;
  to_entry_id: string;
  rel_type: string;
  label?: string | null;
};

export function createLoreRelation(universeId: string, body: CreateLoreRelationPayload) {
  return apiFetch<ApiLoreRelation>(`/universes/${universeId}/codex/relations`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function deleteLoreRelation(relationId: string) {
  return apiFetch<void>(`/codex/relations/${relationId}`, { method: 'DELETE' });
}

export function listTimelineEvents(universeId: string) {
  return apiFetch<ApiTimelineEvent[]>(`/universes/${universeId}/codex/timeline`);
}

export type UpsertTimelinePayload = {
  title: string;
  summary?: string | null;
  body?: string;
  occurred_at_label?: string | null;
  sort_key?: number;
  era_entry_id?: string | null;
  confidence?: string;
  cover_image_url?: string | null;
};

export function createTimelineEvent(universeId: string, body: UpsertTimelinePayload) {
  return apiFetch<ApiTimelineEvent>(`/universes/${universeId}/codex/timeline`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateTimelineEvent(eventId: string, body: Partial<UpsertTimelinePayload>) {
  return apiFetch<ApiTimelineEvent>(`/codex/timeline/${eventId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteTimelineEvent(eventId: string) {
  return apiFetch<void>(`/codex/timeline/${eventId}`, { method: 'DELETE' });
}

export function listLoreAppearances(entryId: string) {
  return apiFetch<ApiLoreAppearance[]>(`/codex/entries/${entryId}/appearances`);
}

export type CreateLoreAppearancePayload = {
  story_id?: string | null;
  chapter_id?: string | null;
  timeline_event_id?: string | null;
  note?: string | null;
};

export function createLoreAppearance(entryId: string, body: CreateLoreAppearancePayload) {
  return apiFetch<ApiLoreAppearance>(`/codex/entries/${entryId}/appearances`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function deleteLoreAppearance(appearanceId: string) {
  return apiFetch<void>(`/codex/appearances/${appearanceId}`, { method: 'DELETE' });
}

export function listArcLoreLinks(arcId: string) {
  return apiFetch<ApiLoreEntry[]>(`/arcs/${arcId}/lore-links`);
}

export function createArcLoreLink(arcId: string, entryId: string) {
  return apiFetch<void>(`/arcs/${arcId}/lore-links`, {
    method: 'POST',
    body: JSON.stringify({ entry_id: entryId }),
  });
}

export function deleteArcLoreLink(arcId: string, entryId: string) {
  return apiFetch<void>(`/arcs/${arcId}/lore-links/${entryId}`, { method: 'DELETE' });
}

export function listMaps(universeId: string) {
  return apiFetch<ApiMap[]>(`/universes/${universeId}/codex/maps`);
}

export type UpsertMapPayload = {
  title: string;
  description?: string | null;
  image_url: string;
  sort_key?: number;
};

export function createMap(universeId: string, body: UpsertMapPayload) {
  return apiFetch<ApiMap>(`/universes/${universeId}/codex/maps`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateMap(mapId: string, body: Partial<UpsertMapPayload>) {
  return apiFetch<ApiMap>(`/codex/maps/${mapId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteMap(mapId: string) {
  return apiFetch<void>(`/codex/maps/${mapId}`, { method: 'DELETE' });
}

export function getMapPins(mapId: string) {
  return apiFetch<ApiMapPin[]>(`/codex/maps/${mapId}/pins`);
}

export type MapPinInput = {
  label: string;
  x_norm: number;
  y_norm: number;
  entry_id?: string | null;
};

export function putMapPins(mapId: string, pins: MapPinInput[]) {
  return apiFetch<ApiMapPin[]>(`/codex/maps/${mapId}/pins`, {
    method: 'PUT',
    body: JSON.stringify({ pins }),
  });
}

export function listGalleryCollections(universeId: string) {
  return apiFetch<ApiGalleryCollection[]>(`/universes/${universeId}/codex/gallery`);
}

export type UpsertGalleryCollectionPayload = {
  title: string;
  description?: string | null;
  sort_key?: number;
};

export function createGalleryCollection(universeId: string, body: UpsertGalleryCollectionPayload) {
  return apiFetch<ApiGalleryCollection>(`/universes/${universeId}/codex/gallery`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateGalleryCollection(collectionId: string, body: Partial<UpsertGalleryCollectionPayload>) {
  return apiFetch<ApiGalleryCollection>(`/codex/gallery/${collectionId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteGalleryCollection(collectionId: string) {
  return apiFetch<void>(`/codex/gallery/${collectionId}`, { method: 'DELETE' });
}

export function getGalleryAssets(collectionId: string) {
  return apiFetch<ApiGalleryAsset[]>(`/codex/gallery/${collectionId}/assets`);
}

export type GalleryAssetInput = {
  image_url: string;
  caption?: string | null;
  art_kind?: string;
  entry_id?: string | null;
  sort_key?: number;
};

export function putGalleryAssets(collectionId: string, assets: GalleryAssetInput[]) {
  return apiFetch<ApiGalleryAsset[]>(`/codex/gallery/${collectionId}/assets`, {
    method: 'PUT',
    body: JSON.stringify({ assets }),
  });
}

export function getCodexToc(universeId: string) {
  return apiFetch<ApiCodexTocItem[]>(`/universes/${universeId}/codex/toc`);
}

export function putCodexToc(universeId: string, items: Omit<ApiCodexTocItem, 'id' | 'universe_id' | 'created_at'>[]) {
  return apiFetch<ApiCodexTocItem[]>(`/universes/${universeId}/codex/toc`, {
    method: 'PUT',
    body: JSON.stringify({ items }),
  });
}

/** Markdown export — not JSON. */
export async function getCodexExportMarkdown(universeId: string): Promise<string> {
  const base = apiBaseUrl();
  if (!base) throw new Error('API is not configured');
  const res = await fetch(`${base}/universes/${universeId}/codex/export.md`, { credentials: 'include' });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? res.statusText);
  }
  return res.text();
}
