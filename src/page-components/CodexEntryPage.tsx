'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Pencil, Save, Trash2 } from 'lucide-react';
import IllustratedBlockEditor, { type IllustratedBlockItem } from '@/components/IllustratedBlockEditor';
import {
  ApiError,
  createLoreAppearance,
  createLoreRelation,
  deleteLoreAppearance,
  deleteLoreEntry,
  deleteLoreRelation,
  getLoreBlocks,
  getLoreEntryBySlug,
  getUniverseStories,
  listLoreAppearances,
  listLoreRelations,
  updateLoreEntry,
} from '@/lib/api';
import type {
  ApiLoreAppearance,
  ApiLoreEntry,
  ApiLoreRelation,
  ApiStoryWithProfile,
  LorePublishState,
  LoreRelationType,
} from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CodexShell } from '@/components/codex/CodexShell';
import { useCodexUniverse } from '@/hooks/useCodexUniverse';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/use-toast';
import { KIND_LABEL_KEYS, kindPagePath } from '@/lib/codex/sections';
import { loreBlocksToEditorItems, saveLoreBlocks } from '@/lib/codex/loreBlocks';
import { LORE_RELATION_TYPES, REL_LABEL_KEYS } from '@/lib/codex/relations';

type ProfileDraft = {
  age: string;
  height: string;
  weight: string;
  role: string;
  voice: string;
  vehicle_class: string;
};

function profileFromFields(fields: Record<string, unknown>): ProfileDraft {
  return {
    age: String(fields.age ?? ''),
    height: String(fields.height ?? ''),
    weight: String(fields.weight ?? ''),
    role: String(fields.role ?? ''),
    voice: String(fields.voice ?? ''),
    vehicle_class: String(fields.vehicle_class ?? ''),
  };
}

function fieldsFromProfile(kind: string, profile: ProfileDraft): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (kind === 'character') {
    if (profile.age.trim()) out.age = profile.age.trim();
    if (profile.height.trim()) out.height = profile.height.trim();
    if (profile.weight.trim()) out.weight = profile.weight.trim();
    if (profile.role.trim()) out.role = profile.role.trim();
    if (profile.voice.trim()) out.voice = profile.voice.trim();
  }
  if (kind === 'vehicle' && profile.vehicle_class.trim()) {
    out.vehicle_class = profile.vehicle_class.trim();
  }
  return out;
}

export default function CodexEntryPage() {
  const params = useParams<{ id: string; slug: string }>();
  const universeId = params?.id;
  const slug = params?.slug ? decodeURIComponent(params.slug) : '';
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const { universe, loading: universeLoading, isOwner } = useCodexUniverse(universeId);
  const owner = isOwner(user?.id);

  const [entry, setEntry] = useState<ApiLoreEntry | null>(null);
  const [blocks, setBlocks] = useState<IllustratedBlockItem[]>([]);
  const [relations, setRelations] = useState<ApiLoreRelation[]>([]);
  const [appearances, setAppearances] = useState<ApiLoreAppearance[]>([]);
  const [stories, setStories] = useState<ApiStoryWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editPublish, setEditPublish] = useState<LorePublishState>('published');
  const [editParentId, setEditParentId] = useState('');
  const [editProfile, setEditProfile] = useState<ProfileDraft>(profileFromFields({}));
  const [editBlocks, setEditBlocks] = useState<IllustratedBlockItem[]>([]);
  const [saving, setSaving] = useState(false);

  const [relToId, setRelToId] = useState('');
  const [relType, setRelType] = useState<LoreRelationType>('related');
  const [appearStoryId, setAppearStoryId] = useState('');

  const entryRelations = useMemo(() => {
    if (!entry) return [];
    return relations.filter((r) => r.from_entry_id === entry.id || r.to_entry_id === entry.id);
  }, [relations, entry]);

  const showProfile = entry?.kind === 'character' || entry?.kind === 'vehicle';
  const showDramaBridge = entry?.kind === 'drama_synopsis' || entry?.kind === 'side_tale';

  const load = async () => {
    if (!universeId || !slug) return;
    setLoading(true);
    try {
      const e = await getLoreEntryBySlug(universeId, slug);
      setEntry(e);
      setEditTitle(e.title);
      setEditSummary(e.summary ?? '');
      setEditPublish(e.publish_state);
      setEditParentId(e.parent_entry_id ?? '');
      setEditProfile(profileFromFields(e.custom_fields ?? {}));
      const blockRows = await getLoreBlocks(e.id);
      const editorItems = loreBlocksToEditorItems(blockRows);
      setBlocks(editorItems);
      setEditBlocks(editorItems);
      const [rels, apps, storyRows] = await Promise.all([
        listLoreRelations(universeId),
        listLoreAppearances(e.id),
        getUniverseStories(universeId),
      ]);
      setRelations(rels);
      setAppearances(apps);
      setStories(storyRows);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err);
      toast({ title: t('common.error'), description: message, variant: 'destructive' });
      setEntry(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universeId, slug]);

  const saveEdits = async () => {
    if (!entry || !user) return;
    setSaving(true);
    try {
      const custom_fields = {
        ...(entry.custom_fields ?? {}),
        ...fieldsFromProfile(entry.kind, editProfile),
      };
      const updated = await updateLoreEntry(entry.id, {
        title: editTitle.trim(),
        summary: editSummary.trim() || null,
        publish_state: editPublish,
        parent_entry_id: editParentId.trim() || null,
        custom_fields,
      });
      setEntry(updated);
      await saveLoreBlocks(entry.id, editBlocks, user.id);
      const blockRows = await getLoreBlocks(entry.id);
      const editorItems = loreBlocksToEditorItems(blockRows);
      setBlocks(editorItems);
      setEditBlocks(editorItems);
      setEditing(false);
      toast({ title: t('codex.entryUpdated') });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err);
      toast({ title: t('common.error'), description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const removeEntry = async () => {
    if (!entry || !window.confirm(t('codex.deleteEntryConfirm'))) return;
    try {
      await deleteLoreEntry(entry.id);
      toast({ title: t('codex.entryDeleted') });
      if (universeId) router.push(`/universe/${universeId}/codex`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err);
      toast({ title: t('common.error'), description: message, variant: 'destructive' });
    }
  };

  const addRelation = async () => {
    if (!universeId || !entry || !relToId.trim()) return;
    try {
      const rel = await createLoreRelation(universeId, {
        from_entry_id: entry.id,
        to_entry_id: relToId.trim(),
        rel_type: relType,
      });
      setRelations((prev) => [...prev, rel]);
      setRelToId('');
      toast({ title: t('codex.relationAdded') });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err);
      toast({ title: t('common.error'), description: message, variant: 'destructive' });
    }
  };

  const removeRelation = async (id: string) => {
    try {
      await deleteLoreRelation(id);
      setRelations((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err);
      toast({ title: t('common.error'), description: message, variant: 'destructive' });
    }
  };

  const addAppearance = async () => {
    if (!entry || !appearStoryId.trim()) return;
    try {
      const app = await createLoreAppearance(entry.id, { story_id: appearStoryId.trim() });
      setAppearances((prev) => [...prev, app]);
      setAppearStoryId('');
      toast({ title: t('codex.appearanceAdded') });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err);
      toast({ title: t('common.error'), description: message, variant: 'destructive' });
    }
  };

  const removeAppearance = async (id: string) => {
    try {
      await deleteLoreAppearance(id);
      setAppearances((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err);
      toast({ title: t('common.error'), description: message, variant: 'destructive' });
    }
  };

  const storyTitle = (id: string | null) => {
    if (!id) return null;
    return stories.find((s) => s.id === id)?.title ?? id;
  };

  const headerActions =
    owner && entry ? (
      <>
        {!editing ? (
          <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(true)}>
            <Pencil className="mr-1 h-4 w-4" aria-hidden />
            {t('common.edit')}
          </Button>
        ) : (
          <Button type="button" size="sm" onClick={saveEdits} disabled={saving}>
            <Save className="mr-1 h-4 w-4" aria-hidden />
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" onClick={removeEntry}>
          <Trash2 className="mr-1 h-4 w-4" aria-hidden />
          {t('common.delete')}
        </Button>
      </>
    ) : undefined;

  const profileView =
    entry && showProfile ? (
      <dl className="grid gap-2 rounded-xl border border-border bg-muted/20 p-4 text-sm sm:grid-cols-2">
        {entry.kind === 'character' ? (
          <>
            {entry.custom_fields?.age ? (
              <>
                <dt className="text-muted-foreground">{t('codex.profile.age')}</dt>
                <dd>{String(entry.custom_fields.age)}</dd>
              </>
            ) : null}
            {entry.custom_fields?.height ? (
              <>
                <dt className="text-muted-foreground">{t('codex.profile.height')}</dt>
                <dd>{String(entry.custom_fields.height)}</dd>
              </>
            ) : null}
            {entry.custom_fields?.weight ? (
              <>
                <dt className="text-muted-foreground">{t('codex.profile.weight')}</dt>
                <dd>{String(entry.custom_fields.weight)}</dd>
              </>
            ) : null}
            {entry.custom_fields?.role ? (
              <>
                <dt className="text-muted-foreground">{t('codex.profile.role')}</dt>
                <dd>{String(entry.custom_fields.role)}</dd>
              </>
            ) : null}
            {entry.custom_fields?.voice ? (
              <>
                <dt className="text-muted-foreground">{t('codex.profile.voice')}</dt>
                <dd>{String(entry.custom_fields.voice)}</dd>
              </>
            ) : null}
          </>
        ) : null}
        {entry.kind === 'vehicle' && entry.custom_fields?.vehicle_class ? (
          <>
            <dt className="text-muted-foreground">{t('codex.profile.vehicleClass')}</dt>
            <dd>{String(entry.custom_fields.vehicle_class)}</dd>
          </>
        ) : null}
      </dl>
    ) : null;

  return (
    <CodexShell universe={universe} loading={universeLoading} title={entry?.title ?? t('codex.entry')} actions={headerActions}>
      {loading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : !entry ? (
        <p className="text-muted-foreground">{t('codex.entryNotFound')}</p>
      ) : (
        <div className="space-y-10">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Link href={universeId ? `/universe/${universeId}/codex` : '#'} className="hover:text-primary">
              {t('codex.backToHub')}
            </Link>
            <span aria-hidden>·</span>
            <Link href={universeId ? kindPagePath(universeId, entry.kind) : '#'} className="hover:text-primary">
              {t(KIND_LABEL_KEYS[entry.kind])}
            </Link>
            {entry.publish_state === 'draft' ? (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">{t('codex.draft')}</span>
            ) : null}
          </div>

          {entry.cover_image_url ? (
            <img src={entry.cover_image_url} alt="" className="max-h-64 w-full rounded-xl object-cover" />
          ) : null}

          {editing ? (
            <div className="space-y-4 rounded-xl border border-border bg-card p-4">
              <div>
                <label className="text-sm font-medium">{t('codex.entryTitle')}</label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">{t('codex.entrySummary')}</label>
                <Textarea value={editSummary} onChange={(e) => setEditSummary(e.target.value)} rows={3} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">{t('codex.publishState')}</label>
                  <select
                    className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-2 text-sm"
                    value={editPublish}
                    onChange={(e) => setEditPublish(e.target.value as LorePublishState)}
                  >
                    <option value="published">{t('codex.published')}</option>
                    <option value="draft">{t('codex.draft')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">{t('codex.parentEntryId')}</label>
                  <Input
                    value={editParentId}
                    onChange={(e) => setEditParentId(e.target.value)}
                    placeholder="uuid"
                  />
                </div>
              </div>
              {showProfile ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {entry.kind === 'character' ? (
                    <>
                      <div>
                        <label className="text-sm font-medium">{t('codex.profile.age')}</label>
                        <Input
                          value={editProfile.age}
                          onChange={(e) => setEditProfile({ ...editProfile, age: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">{t('codex.profile.height')}</label>
                        <Input
                          value={editProfile.height}
                          onChange={(e) => setEditProfile({ ...editProfile, height: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">{t('codex.profile.weight')}</label>
                        <Input
                          value={editProfile.weight}
                          onChange={(e) => setEditProfile({ ...editProfile, weight: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">{t('codex.profile.role')}</label>
                        <Input
                          value={editProfile.role}
                          onChange={(e) => setEditProfile({ ...editProfile, role: e.target.value })}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-sm font-medium">{t('codex.profile.voice')}</label>
                        <Input
                          value={editProfile.voice}
                          onChange={(e) => setEditProfile({ ...editProfile, voice: e.target.value })}
                        />
                      </div>
                    </>
                  ) : (
                    <div>
                      <label className="text-sm font-medium">{t('codex.profile.vehicleClass')}</label>
                      <select
                        className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-2 text-sm"
                        value={editProfile.vehicle_class}
                        onChange={(e) => setEditProfile({ ...editProfile, vehicle_class: e.target.value })}
                      >
                        <option value="">{t('codex.profile.vehicleClassNone')}</option>
                        <option value="gear">gear</option>
                        <option value="ship">ship</option>
                        <option value="other">other</option>
                      </select>
                    </div>
                  )}
                </div>
              ) : null}
              <div>
                <label className="mb-2 block text-sm font-medium">{t('codex.blocks')}</label>
                <IllustratedBlockEditor blocks={editBlocks} onChange={setEditBlocks} />
              </div>
            </div>
          ) : (
            <>
              {entry.summary ? <p className="text-pretty text-muted-foreground">{entry.summary}</p> : null}
              {profileView}
              <article className="space-y-4">
                {blocks.map((block, i) =>
                  block.block_type === 'text' ? (
                    <p key={block.id ?? i} className="whitespace-pre-wrap leading-relaxed">
                      {block.content}
                    </p>
                  ) : (
                    <img key={block.id ?? i} src={block.content} alt="" className="mx-auto max-h-[480px] rounded-lg" />
                  ),
                )}
              </article>
            </>
          )}

          <section>
            <h2 className="mb-3 text-lg font-semibold">{t('codex.relations')}</h2>
            {entryRelations.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('codex.noRelations')}</p>
            ) : (
              <ul className="space-y-2">
                {entryRelations.map((rel) => (
                  <li key={rel.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                    <span>
                      {(REL_LABEL_KEYS[rel.rel_type] ? t(REL_LABEL_KEYS[rel.rel_type]!) : rel.rel_type)} →{' '}
                      {rel.to_entry_id === entry.id ? rel.from_entry_id : rel.to_entry_id}
                    </span>
                    {owner ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeRelation(rel.id)}>
                        {t('common.delete')}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {owner ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <Input
                  className="max-w-xs"
                  placeholder={t('codex.relationTargetId')}
                  value={relToId}
                  onChange={(e) => setRelToId(e.target.value)}
                />
                <select
                  value={relType}
                  onChange={(e) => setRelType(e.target.value as LoreRelationType)}
                  className="h-10 rounded-lg border border-input bg-background px-2 text-sm"
                >
                  {LORE_RELATION_TYPES.map((rt) => (
                    <option key={rt} value={rt}>
                      {REL_LABEL_KEYS[rt] ? t(REL_LABEL_KEYS[rt]!) : rt}
                    </option>
                  ))}
                </select>
                <Button type="button" size="sm" variant="outline" onClick={addRelation}>
                  {t('codex.addRelation')}
                </Button>
              </div>
            ) : null}
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">
              {showDramaBridge ? t('codex.linkedStories') : t('codex.appearances')}
            </h2>
            {appearances.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('codex.noAppearances')}</p>
            ) : (
              <ul className="space-y-2">
                {appearances.map((app) => (
                  <li key={app.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                    <span>
                      {app.story_id ? (
                        <Link href={`/story/${app.story_id}`} className="text-primary hover:underline">
                          {storyTitle(app.story_id)}
                        </Link>
                      ) : null}
                      {app.timeline_event_id ? `${t('codex.timeline')}: ${app.timeline_event_id}` : null}
                      {app.chapter_id ? `${t('codex.chapter')}: ${app.chapter_id}` : null}
                    </span>
                    {owner ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeAppearance(app.id)}>
                        {t('common.delete')}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {owner ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <select
                  className="h-10 max-w-sm rounded-lg border border-input bg-background px-2 text-sm"
                  value={appearStoryId}
                  onChange={(e) => setAppearStoryId(e.target.value)}
                >
                  <option value="">{t('codex.selectStory')}</option>
                  {stories.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
                <Button type="button" size="sm" variant="outline" onClick={addAppearance} disabled={!appearStoryId}>
                  {t('codex.addAppearance')}
                </Button>
              </div>
            ) : null}
          </section>
        </div>
      )}
    </CodexShell>
  );
}
