import { useState, useEffect, useMemo, useRef } from 'react';
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ApiError,
  createArc,
  deleteArc as deleteArcApi,
  getUniverseArcs,
  getUniverseById,
  getUniverseStories,
  updateArc,
  updateUniverse,
} from '@/lib/api';
import {
  followUniverse,
  getFollowStatus,
  unfollowUniverse,
} from '@/lib/api/social';
import { uploadFile } from '@/lib/api/storage';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Header from '@/components/Header';
import PreviousScreenBackButton from '@/components/PreviousScreenBackButton';
import CharacterMeter from '@/components/CharacterMeter';
import StoryCard from '@/components/StoryCard';
import { useToast } from '@/hooks/use-toast';
import { CONTENT_LIMITS, describeViolations, validateArcFields, validateUniverseFields } from '@/lib/contentLimits';
import { Plus, Pencil, X, ImagePlus, FileText, BookOpen, Image, Globe, Save } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';
import type { TranslationKey } from '@/i18n/translations';
import { cn } from '@/lib/utils';
import { BrowseContentRow, browseStoryTileClassNarrow } from '@/components/browse/BrowseContentRow';
import { HorizontalScrollStrip } from '@/components/browse/HorizontalScrollStrip';
import { UniverseArcShelfTile } from '@/components/universe/UniverseArcShelfTile';

const TYPE_FILTERS: { value: string; labelKey: TranslationKey; icon: React.ReactNode }[] = [
  { value: 'short_story', labelKey: 'type.short_story', icon: <FileText className="h-3 w-3" /> },
  { value: 'chapters', labelKey: 'type.chapters', icon: <BookOpen className="h-3 w-3" /> },
  { value: 'comic', labelKey: 'type.comic', icon: <Image className="h-3 w-3" /> },
];

const ARC_TYPES: { value: Tables<'arcs'>['type']; labelKey: TranslationKey }[] = [
  { value: 'character', labelKey: 'arcType.character' },
  { value: 'era', labelKey: 'arcType.era' },
  { value: 'planet', labelKey: 'arcType.planet' },
  { value: 'event', labelKey: 'arcType.event' },
  { value: 'custom', labelKey: 'arcType.custom' },
];

interface Universe {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  owner_id: string;
  created_at: string;
}

export type UniversePageProps = {
  embedExploration?: boolean;
  universeIdOverride?: string;
  explorationPushStory?: (storyId: string) => void;
  explorationPushArc?: (arcId: string) => void;
};

type StoryWithProfile = Tables<'stories'> & { profiles: { username: string; avatar_url: string | null } | null };
type Arc = Tables<'arcs'>;

/** Netflix-style horizontal shelf of story posters (scroll + snap). */
function UniverseStoriesShelf({
  stories,
  onOpenStoryExplore,
}: {
  stories: StoryWithProfile[];
  onOpenStoryExplore?: (storyId: string) => void;
}) {
  return (
    <HorizontalScrollStrip>
      {stories.map((story) => (
        <div key={story.id} className={browseStoryTileClassNarrow()}>
          <StoryCard
            story={story}
            onOpenInFeedExplore={onOpenStoryExplore ? () => onOpenStoryExplore(story.id) : undefined}
          />
        </div>
      ))}
    </HorizontalScrollStrip>
  );
}

export default function UniversePage({
  embedExploration = false,
  universeIdOverride,
  explorationPushStory,
  explorationPushArc,
}: UniversePageProps = {}) {
  const params = useParams<{ id: string }>();
  const id = (universeIdOverride ?? params?.id) as string | undefined;
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [universe, setUniverse] = useState<Universe | null>(null);
  const [stories, setStories] = useState<StoryWithProfile[]>([]);
  const [arcs, setArcs] = useState<Arc[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editCoverPreview, setEditCoverPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [showArcForm, setShowArcForm] = useState(false);
  const [editingArcId, setEditingArcId] = useState<string | null>(null);
  const [arcName, setArcName] = useState('');
  const [arcDescription, setArcDescription] = useState('');
  const [arcType, setArcType] = useState<Arc['type']>('custom');
  const [arcCoverFile, setArcCoverFile] = useState<File | null>(null);
  const [arcCoverPreview, setArcCoverPreview] = useState<string | null>(null);
  const [savingArc, setSavingArc] = useState(false);
  const arcCoverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id) fetchUniverse();
  }, [id, activeType, user]);

  const fetchUniverse = async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      const universeData = await getUniverseById(id);
      setUniverse(universeData as Universe);

      const arcData = await getUniverseArcs(id);
      setArcs(arcData as Arc[]);

      if (user) {
        const { following: isFollowing } = await getFollowStatus(id);
        setFollowing(isFollowing);
      } else {
        setFollowing(false);
      }

      const storiesData = await getUniverseStories(id, activeType);
      setStories(storiesData as StoryWithProfile[]);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err);
      toast({ title: t('common.error'), description: message, variant: 'destructive' });
      setUniverse(null);
    } finally {
      setLoading(false);
    }
  };

  const uploadArcCover = async (file: File) => {
    if (!user) throw new Error('Not authenticated');
    const ext = file.name.split('.').pop();
    const path = `${user!.id}/${crypto.randomUUID()}.${ext}`;
    return uploadFile('arc-covers', file, path);
  };

  const resetArcForm = () => {
    setShowArcForm(false);
    setEditingArcId(null);
    setArcName('');
    setArcDescription('');
    setArcType('custom');
    setArcCoverFile(null);
    setArcCoverPreview(null);
    if (arcCoverInputRef.current) arcCoverInputRef.current.value = '';
  };

  const startEditingArc = (arc: Arc) => {
    setEditingArcId(arc.id);
    setArcName(arc.name);
    setArcDescription(arc.description || '');
    setArcType(arc.type);
    setArcCoverFile(null);
    setArcCoverPreview(arc.cover_image_url || null);
    setShowArcForm(true);
  };

  const saveArc = async () => {
    const nT = arcName.trim();
    const descT = arcDescription.trim();
    if (!user || !universe || !nT) return;
    const aV = validateArcFields(nT, descT);
    if (aV.length) {
      toast({
        title: t('validation.charLimitsTitle'),
        description: describeViolations(t, aV),
        variant: 'destructive',
      });
      return;
    }
    setSavingArc(true);
    try {
      let cover_image_url = editingArcId
        ? arcs.find((arc) => arc.id === editingArcId)?.cover_image_url || null
        : null;

      if (arcCoverFile) {
        cover_image_url = await uploadArcCover(arcCoverFile);
      } else if (!arcCoverPreview) {
        cover_image_url = null;
      }

      if (!user) throw new Error('Not authenticated');
      const payload = {
        name: nT,
        description: descT || null,
        type: arcType,
        cover_image_url,
      };
      if (editingArcId) {
        await updateArc(editingArcId, payload);
        toast({ title: t('universe.arcUpdated') });
      } else {
        await createArc(universe.id, payload);
        toast({ title: t('universe.arcCreated') });
      }

      resetArcForm();
      fetchUniverse();
    } catch (err: any) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    } finally {
      setSavingArc(false);
    }
  };

  const deleteArc = async (arcId: string) => {
    if (!window.confirm(t('universe.deleteArcConfirm'))) return;
    if (!user) return;
    try {
      await deleteArcApi(arcId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast({ title: t('common.error'), description: message, variant: 'destructive' });
      return;
    }
    toast({ title: t('universe.arcDeleted') });
    if (editingArcId === arcId) resetArcForm();
    fetchUniverse();
  };

  const isOwner = user?.id === universe?.owner_id;

  const toggleFollow = async () => {
    if (!user || !universe || isOwner) return;
    if (!user) return;
    try {
      if (following) {
        await unfollowUniverse(universe.id);
        setFollowing(false);
      } else {
        await followUniverse(universe.id);
        setFollowing(true);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast({ title: t('common.error'), description: message, variant: 'destructive' });
    }
  };

  const startEditing = () => {
    if (!universe) return;
    setEditTitle(universe.title);
    setEditDescription(universe.description || '');
    setEditCoverPreview(universe.cover_image_url || null);
    setEditCoverFile(null);
    setEditing(true);
  };

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast({ title: t('story.imageTooLarge'), variant: 'destructive' }); return; }
    setEditCoverFile(file);
    setEditCoverPreview(URL.createObjectURL(file));
  };

  const handleArcCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast({ title: t('story.imageTooLarge'), variant: 'destructive' }); return; }
    setArcCoverFile(file);
    setArcCoverPreview(URL.createObjectURL(file));
  };

  const saveEdits = async () => {
    if (!universe || !user || !editTitle.trim()) return;
    const tT = editTitle.trim();
    const dT = editDescription.trim();
    const uniV = validateUniverseFields(tT, dT);
    if (uniV.length) {
      toast({
        title: t('validation.charLimitsTitle'),
        description: describeViolations(t, uniV),
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      let cover_image_url = universe.cover_image_url;
      if (!user) throw new Error('Not authenticated');
      if (editCoverFile) {
        const ext = editCoverFile.name.split('.').pop();
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        cover_image_url = await uploadFile('universe-covers', editCoverFile, path);
      } else if (!editCoverPreview) {
        cover_image_url = null;
      }

      await updateUniverse(universe.id, {
        title: tT,
        description: dT || null,
        cover_image_url,
      });
      toast({ title: t('universe.updated') });
      setEditing(false);
      fetchUniverse();
    } catch (err: any) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const arcStoryMap = useMemo(() => {
    const groups = new Map<string, StoryWithProfile[]>();
    for (const story of stories) {
      if (!story.arc_id) continue;
      if (!groups.has(story.arc_id)) groups.set(story.arc_id, []);
      groups.get(story.arc_id)!.push(story);
    }
    const t = (a: StoryWithProfile, b: StoryWithProfile) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    for (const list of groups.values()) list.sort(t);
    return groups;
  }, [stories]);

  const unassignedStories = useMemo(
    () =>
      stories
        .filter((story) => !story.arc_id)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [stories],
  );

  const editUniverseViolations = validateUniverseFields(editTitle.trim(), editDescription.trim());
  const editUniverseOverLimit = editUniverseViolations.length > 0;

  const arcViolations = validateArcFields(arcName.trim(), arcDescription.trim());
  const arcOverLimit = arcViolations.length > 0;

  const editingArc = editingArcId ? arcs.find((a) => a.id === editingArcId) ?? null : null;

  const uShell = embedExploration ? 'min-h-full bg-background' : 'min-h-screen bg-background';

  if (!id) {
    return (
      <div className={uShell}>
        {!embedExploration && <Header />}
        <div className="container py-20 text-center text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  if (loading && !universe) {
    return (
      <div className={uShell}>
        {!embedExploration && <Header />}
        {!embedExploration && (
          <div className="container max-w-6xl py-6">
            <PreviousScreenBackButton />
          </div>
        )}
        <div className="container py-20 text-center text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  if (!universe) {
    return (
      <div className={uShell}>
        {!embedExploration && <Header />}
        {!embedExploration && (
          <div className="container max-w-6xl py-6">
            <PreviousScreenBackButton />
          </div>
        )}
        <div className="container py-20 text-center text-muted-foreground">{t('universe.notFound')}</div>
      </div>
    );
  }

  const arcEditorFields = (
    <>
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">{t('universe.arcCover')}</label>
        <input ref={arcCoverInputRef} type="file" accept="image/*" onChange={handleArcCoverSelect} className="hidden" />
        {arcCoverPreview ? (
          <div className="relative w-full aspect-[16/9] max-w-sm rounded-lg overflow-hidden border border-border">
            <img src={arcCoverPreview} alt="Preview" className="w-full h-full object-cover" />
            <button type="button" onClick={() => { setArcCoverFile(null); setArcCoverPreview(null); }} className="absolute top-2 right-2 p-1 rounded-full bg-background/80 hover:bg-background text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => arcCoverInputRef.current?.click()} className="flex flex-col items-center justify-center w-full aspect-[16/9] max-w-sm rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors bg-muted/30">
            <ImagePlus className="h-8 w-8 text-muted-foreground mb-2" />
            <span className="text-xs text-muted-foreground">{t('universe.addArcCover')}</span>
          </button>
        )}
      </div>
      <div>
        <label className="text-sm font-medium text-foreground">{t('universe.arcName')}</label>
        <Input value={arcName} onChange={(e) => setArcName(e.target.value)} />
        <CharacterMeter length={arcName.length} max={CONTENT_LIMITS.arcName} className="mt-1 text-right" />
      </div>
      <div>
        <label className="text-sm font-medium text-foreground">{t('universe.arcDescription')}</label>
        <Textarea value={arcDescription} onChange={(e) => setArcDescription(e.target.value)} rows={3} />
        <CharacterMeter length={arcDescription.length} max={CONTENT_LIMITS.arcDescription} className="mt-1 text-right" />
      </div>
      <div>
        <label className="text-sm font-medium text-foreground">{t('universe.arcType')}</label>
        <select
          value={arcType}
          onChange={(e) => setArcType(e.target.value as Arc['type'])}
          className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
        >
          {ARC_TYPES.map((option) => (
            <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2 max-sm:flex-col-reverse">
        <Button type="button" onClick={saveArc} disabled={savingArc || !arcName.trim() || arcOverLimit} size="sm" className="max-sm:h-11 max-sm:w-full max-sm:touch-manipulation gradient-warm text-primary-foreground">
          {savingArc ? t('common.saving') : t('common.save')}
        </Button>
        <Button variant="outline" size="sm" type="button" className="max-sm:h-11 max-sm:w-full max-sm:touch-manipulation" onClick={resetArcForm}>
          {t('common.cancel')}
        </Button>
      </div>
    </>
  );

  return (
    <div className={uShell}>
      {!embedExploration && <Header />}
      <main className="container min-w-0 max-w-6xl py-8 max-sm:py-6 animate-fade-in">
        {!embedExploration && <PreviousScreenBackButton className="-mt-1 mb-4" />}
        {editing ? (
          <div className="mb-8 space-y-4 rounded-lg border border-border bg-card p-4 max-sm:p-3 max-sm:shadow-sm sm:p-4">
            <div className="flex items-center justify-between gap-3 max-sm:items-start max-sm:border-b max-sm:border-border max-sm:pb-3">
              <h2 className="min-w-0 text-lg font-semibold leading-snug">{t('universe.editUniverse')}</h2>
              <Button variant="ghost" size="sm" type="button" className="max-sm:h-10 max-sm:w-10 max-sm:shrink-0 max-sm:p-0 max-sm:touch-manipulation" onClick={() => setEditing(false)} aria-label={t('common.cancel')}>
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">{t('createUniverse.cover')}</label>
              <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverSelect} className="hidden" />
              {editCoverPreview ? (
                <div className="relative w-full aspect-[16/9] max-w-sm rounded-lg overflow-hidden border border-border">
                  <img src={editCoverPreview} alt="Preview" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => { setEditCoverFile(null); setEditCoverPreview(null); }} className="absolute top-2 right-2 p-1 rounded-full bg-background/80 hover:bg-background text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => coverInputRef.current?.click()} className="flex flex-col items-center justify-center w-full aspect-[16/9] max-w-sm rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors bg-muted/30">
                  <ImagePlus className="h-8 w-8 text-muted-foreground mb-2" />
                  <span className="text-xs text-muted-foreground">{t('createUniverse.addCover')}</span>
                </button>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">{t('createUniverse.nameLabel')}</label>
              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} />
              <CharacterMeter length={editTitle.length} max={CONTENT_LIMITS.universeTitle} className="mt-1 text-right" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">{t('createUniverse.descLabel')}</label>
              <Textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={4} />
              <CharacterMeter length={editDescription.length} max={CONTENT_LIMITS.universeDescription} className="mt-1 text-right" />
            </div>
            <div className="flex flex-wrap gap-2 max-sm:flex-col-reverse">
              <Button onClick={saveEdits} disabled={saving || !editTitle.trim() || editUniverseOverLimit} size="sm" type="button" className="max-sm:h-11 max-sm:w-full max-sm:touch-manipulation gradient-warm text-primary-foreground">
                <Save className="mr-1 h-4 w-4 shrink-0" aria-hidden />
                {saving ? t('common.saving') : t('common.save')}
              </Button>
              <Button variant="outline" size="sm" type="button" className="max-sm:h-11 max-sm:w-full max-sm:touch-manipulation" onClick={() => setEditing(false)}>
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <div className={cn('relative mb-10', !embedExploration && '-mx-8')}>
            {universe.cover_image_url ? (
              <div className="relative overflow-hidden border-b border-border sm:rounded-2xl sm:border sm:border-border">
                <div className="relative aspect-[2/1] min-h-[13rem] max-h-[min(42vh,24rem)] w-full sm:aspect-[21/9] sm:max-h-[min(46vh,28rem)]">
                  <img
                    src={universe.cover_image_url}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover [-webkit-touch-callout:none]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background from-[36%] via-background/60 to-transparent" aria-hidden />
                  <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/25 to-transparent sm:from-background/75" aria-hidden />
                </div>
                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-4 p-5 pb-7 sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:p-8 md:p-10">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-start gap-2.5">
                      <Globe className="mt-0.5 h-5 w-5 shrink-0 text-primary sm:h-6 sm:w-6" aria-hidden />
                      <h1 className="text-balance font-serif text-2xl font-bold leading-tight tracking-tight sm:text-3xl md:text-4xl">{universe.title}</h1>
                    </div>
                    {universe.description ? (
                      <p className="max-w-3xl text-pretty text-sm leading-relaxed text-muted-foreground line-clamp-4 sm:text-base">{universe.description}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                    {!isOwner && user ? (
                      <Button type="button" variant="outline" size="sm" onClick={toggleFollow} className="touch-manipulation sm:shrink-0">
                        {following ? t('universe.unfollow') : t('universe.follow')}
                      </Button>
                    ) : null}
                    {isOwner && !embedExploration ? (
                      <Button type="button" variant="secondary" size="sm" onClick={startEditing} className="touch-manipulation sm:shrink-0">
                        <Pencil className="mr-1 h-4 w-4 shrink-0" aria-hidden /> {t('common.edit')}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-gradient-to-br from-card via-background to-muted/40 px-6 py-8 sm:px-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-start gap-2.5">
                      <Globe className="mt-0.5 h-5 w-5 shrink-0 text-primary sm:h-6 sm:w-6" aria-hidden />
                      <h1 className="text-balance font-serif text-2xl font-bold leading-tight sm:text-3xl">{universe.title}</h1>
                    </div>
                    {universe.description ? (
                      <p className="max-w-3xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">{universe.description}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {!isOwner && user ? (
                      <Button type="button" variant="outline" size="sm" onClick={toggleFollow}>
                        {following ? t('universe.unfollow') : t('universe.follow')}
                      </Button>
                    ) : null}
                    {isOwner && !embedExploration ? (
                      <Button type="button" variant="secondary" size="sm" onClick={startEditing}>
                        <Pencil className="mr-1 h-4 w-4 shrink-0" aria-hidden /> {t('common.edit')}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <section className="mb-10">
          <div className="mb-4 flex items-center justify-between gap-4 max-sm:flex-col max-sm:items-stretch">
            <h2 className="text-lg font-semibold leading-snug">{t('universe.arcs')}</h2>
            {isOwner && !embedExploration && (
              <Button
                size="sm"
                type="button"
                variant="outline"
                className="max-sm:h-11 max-sm:w-full max-sm:flex-initial max-sm:justify-center max-sm:touch-manipulation sm:shrink-0"
                onClick={() => {
                  if (showArcForm && !editingArcId) {
                    resetArcForm();
                  } else {
                    resetArcForm();
                    setShowArcForm(true);
                  }
                }}
              >
                <Plus className="mr-1 h-4 w-4 shrink-0" aria-hidden /> {t('universe.newArc')}
              </Button>
            )}
          </div>

          {showArcForm && !editingArcId && isOwner && !embedExploration && (
            <div className="mb-6 space-y-4 rounded-lg border border-border bg-card p-4 max-sm:p-3 max-sm:shadow-sm">
              <div className="flex items-center justify-between gap-3 max-sm:items-start max-sm:border-b max-sm:border-border max-sm:pb-3">
                <h3 className="min-w-0 font-semibold leading-snug">{t('universe.newArc')}</h3>
                <Button variant="ghost" size="sm" type="button" className="max-sm:h-10 max-sm:w-10 max-sm:shrink-0 max-sm:p-0 max-sm:touch-manipulation" onClick={resetArcForm} aria-label={t('common.cancel')}>
                  <X className="h-4 w-4" aria-hidden />
                </Button>
              </div>
              {arcEditorFields}
            </div>
          )}

          {arcs.length === 0 ? (
            <p className="text-muted-foreground">{t('universe.noArcs')}</p>
          ) : (
            <>
              {editingArcId && isOwner && !embedExploration && editingArc ? (
                <div className="mb-6 min-w-0 max-w-full overflow-hidden rounded-xl border border-border bg-card max-sm:shadow-sm">
                  {editingArc.cover_image_url ? (
                    <div className="aspect-[16/5] overflow-hidden border-b border-border [-webkit-touch-callout:none] max-sm:aspect-[16/6]">
                      <img src={editingArc.cover_image_url} alt="" className="h-full w-full object-cover" />
                    </div>
                  ) : null}
                  <div className="space-y-4 p-4 max-sm:p-3">
                    <div className="flex items-center justify-between gap-3 max-sm:items-start max-sm:border-b max-sm:border-border max-sm:pb-3">
                      <h3 className="min-w-0 font-semibold leading-snug">{t('universe.editArc')}</h3>
                      <Button variant="ghost" size="sm" type="button" className="max-sm:h-10 max-sm:w-10 max-sm:shrink-0 max-sm:p-0 max-sm:touch-manipulation" onClick={resetArcForm} aria-label={t('common.cancel')}>
                        <X className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                    {arcEditorFields}
                  </div>
                </div>
              ) : null}
              <div className={cn('min-w-0 max-w-full', !embedExploration && '-mx-8')}>
                <HorizontalScrollStrip stripClassName={cn(!embedExploration && 'px-8 scroll-pl-8 scroll-pr-8')}>
                  {arcs
                    .filter((arc) => !(editingArcId && isOwner && !embedExploration && arc.id === editingArcId))
                    .map((arc) => (
                      <UniverseArcShelfTile
                        key={arc.id}
                        arc={arc}
                        storyCount={(arcStoryMap.get(arc.id) || []).length}
                        isOwner={isOwner}
                        embedExploration={embedExploration}
                        explorationPushArc={explorationPushArc}
                        onEdit={isOwner && !embedExploration ? () => startEditingArc(arc) : undefined}
                        onDelete={isOwner && !embedExploration ? () => deleteArc(arc.id) : undefined}
                      />
                    ))}
                </HorizontalScrollStrip>
              </div>
            </>
          )}
        </section>

        <section className="mb-6">
          <div className="mb-4 flex items-center justify-between gap-4 max-sm:flex-col max-sm:items-stretch">
            <h2 className="text-lg font-semibold leading-snug">{t('universe.stories')}</h2>
            {isOwner && !embedExploration && (
              <Button asChild size="sm" className="max-sm:h-11 max-sm:w-full max-sm:flex-initial max-sm:justify-center max-sm:touch-manipulation gradient-warm text-primary-foreground sm:shrink-0">
                <Link href={`/universe/${id}/create-story`} className="inline-flex items-center justify-center gap-1">
                  <Plus className="h-4 w-4 shrink-0" aria-hidden /> {t('universe.newStory')}
                </Link>
              </Button>
            )}
          </div>

          <div className="mb-6 flex flex-wrap gap-2 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:snap-x max-sm:snap-mandatory max-sm:pb-2 max-sm:[-ms-overflow-style:none] max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden [-webkit-overflow-scrolling:touch]">
            <button
              type="button"
              onClick={() => setActiveType(null)}
              className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition-colors max-sm:snap-start max-sm:touch-manipulation max-sm:py-2.5 max-sm:text-[11px] max-sm:font-medium max-sm:uppercase max-sm:tracking-wide ${!activeType ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground'}`}
            >
              {t('common.all')}
            </button>
            {TYPE_FILTERS.map((tf) => (
              <button
                key={tf.value}
                type="button"
                onClick={() => setActiveType(activeType === tf.value ? null : tf.value)}
                className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition-colors max-sm:snap-start max-sm:touch-manipulation max-sm:py-2.5 max-sm:text-[11px] ${activeType === tf.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground'}`}
              >
                <span className="shrink-0">{tf.icon}</span>
                <span className="max-sm:max-w-[10rem] max-sm:text-balance max-sm:break-words">{t(tf.labelKey)}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-muted-foreground text-center">{t('common.loading')}</p>
          ) : stories.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">{t('universe.noStories')}</p>
              {isOwner && !embedExploration && (
                <Button asChild className="mt-4 gradient-warm text-primary-foreground max-sm:mx-auto max-sm:h-11 max-sm:w-full max-sm:max-w-sm max-sm:touch-manipulation">
                  <Link href={`/universe/${id}/create-story`}>{t('universe.createFirst')}</Link>
                </Button>
              )}
            </div>
          ) : unassignedStories.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-6 text-center text-sm leading-relaxed text-muted-foreground">
              {t('universe.noStoriesWithoutArc')}
            </p>
          ) : (
            <BrowseContentRow title={t('universe.storiesWithoutArc')} bleed={!embedExploration} layout="panel">
              <UniverseStoriesShelf stories={unassignedStories} onOpenStoryExplore={explorationPushStory} />
            </BrowseContentRow>
          )}
        </section>
      </main>
    </div>
  );
}
