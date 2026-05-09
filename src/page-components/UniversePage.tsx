import { useState, useEffect, useMemo, useRef } from 'react';
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Header from '@/components/Header';
import CharacterMeter from '@/components/CharacterMeter';
import StoryCard from '@/components/StoryCard';
import { useToast } from '@/hooks/use-toast';
import { CONTENT_LIMITS, describeViolations, validateArcFields, validateUniverseFields } from '@/lib/contentLimits';
import { Plus, Pencil, X, ImagePlus, FileText, BookOpen, Image, Layers, Globe, Save } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';
import type { TranslationKey } from '@/i18n/translations';
import { cn } from '@/lib/utils';

const TYPE_FILTERS: { value: string; labelKey: TranslationKey; icon: React.ReactNode }[] = [
  { value: 'short_story', labelKey: 'type.short_story', icon: <FileText className="h-3 w-3" /> },
  { value: 'chapters', labelKey: 'type.chapters', icon: <BookOpen className="h-3 w-3" /> },
  { value: 'comic', labelKey: 'type.comic', icon: <Image className="h-3 w-3" /> },
  { value: 'illustrated', labelKey: 'type.illustrated', icon: <Layers className="h-3 w-3" /> },
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

type StoryWithProfile = Tables<'stories'> & { profiles: { username: string; avatar_url: string | null } | null };
type Arc = Tables<'arcs'>;

/* Lista de cards: até sm carrossel horizontal com scroll controlado; a partir de sm mantém grid. */
function UniverseStoriesShelf({ stories }: { stories: StoryWithProfile[] }) {
  return (
    <div
      className={cn(
        '-mx-1 flex flex-nowrap gap-3 overflow-x-auto overflow-y-hidden px-1 pb-2 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        'snap-x snap-mandatory',
        'sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 md:grid-cols-4 sm:overflow-visible sm:px-0 sm:pb-0 sm:snap-none',
      )}
    >
      {stories.map((story) => (
        <div
          key={story.id}
          className={cn(
            'shrink-0 snap-start [-webkit-scroll-snap-stop:always] [scroll-snap-stop:always] sm:[scroll-snap-stop:normal]',
            'w-[clamp(9.75rem,40vw,13.5rem)] min-w-[9.75rem] max-w-[13.5rem]',
            'sm:w-auto sm:min-w-0 sm:max-w-none sm:shrink',
          )}
        >
          <StoryCard story={story} />
        </div>
      ))}
    </div>
  );
}

export default function UniversePage() {
  const { id } = useParams<{ id: string }>() as { id: string };
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
    setLoading(true);

    const { data: universeData } = await (supabase.from('universes') as any).select('*').eq('id', id!).single();
    if (!universeData) {
      setUniverse(null);
      setLoading(false);
      return;
    }
    setUniverse(universeData);

    const { data: arcData } = await supabase
      .from('arcs')
      .select('*')
      .eq('universe_id', id!)
      .order('created_at', { ascending: false });
    setArcs(arcData || []);

    if (user) {
      const { data: followData } = await supabase
        .from('universe_follows')
        .select('*')
        .eq('universe_id', id!)
        .eq('user_id', user.id)
        .maybeSingle();
      setFollowing(!!followData);
    } else {
      setFollowing(false);
    }

    let query = supabase.from('stories').select('*').eq('universe_id', id!).order('created_at', { ascending: false });
    if (activeType) query = query.eq('type', activeType);
    const { data: storiesData } = await query;

    const storyList = (storiesData || []) as Tables<'stories'>[];
    const authorIds = [...new Set(storyList.map(s => s.author_id))];
    let profileMap = new Map<string, { username: string; avatar_url: string | null }>();
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('user_id, username, avatar_url').in('user_id', authorIds);
      profileMap = new Map(profiles?.map(p => [p.user_id, { username: p.username, avatar_url: p.avatar_url }]) || []);
    }

    setStories(storyList.map(s => ({ ...s, profiles: profileMap.get(s.author_id) || null })));
    setLoading(false);
  };

  const uploadArcCover = async (file: File) => {
    const ext = file.name.split('.').pop();
    const path = `${user!.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('arc-covers').upload(path, file);
    if (error) throw error;
    return supabase.storage.from('arc-covers').getPublicUrl(path).data.publicUrl;
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

      if (editingArcId) {
        const { error } = await supabase.from('arcs').update({
          name: nT,
          description: descT || null,
          type: arcType,
          cover_image_url,
        }).eq('id', editingArcId);
        if (error) throw error;
        toast({ title: t('universe.arcUpdated') });
      } else {
        const { error } = await supabase.from('arcs').insert({
          universe_id: universe.id,
          name: nT,
          description: descT || null,
          type: arcType,
          cover_image_url,
        });
        if (error) throw error;
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
    const { error } = await supabase.from('arcs').delete().eq('id', arcId);
    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: t('universe.arcDeleted') });
    if (editingArcId === arcId) resetArcForm();
    fetchUniverse();
  };

  const isOwner = user?.id === universe?.owner_id;

  const toggleFollow = async () => {
    if (!user || !universe || isOwner) return;
    if (following) {
      const { error } = await supabase.from('universe_follows').delete().eq('universe_id', universe.id).eq('user_id', user.id);
      if (error) {
        toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
        return;
      }
      setFollowing(false);
      return;
    }

    const { error } = await supabase.from('universe_follows').insert({ universe_id: universe.id, user_id: user.id });
    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
      return;
    }
    setFollowing(true);
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
      if (editCoverFile) {
        const ext = editCoverFile.name.split('.').pop();
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('universe-covers').upload(path, editCoverFile);
        if (uploadErr) throw uploadErr;
        cover_image_url = supabase.storage.from('universe-covers').getPublicUrl(path).data.publicUrl;
      } else if (!editCoverPreview) {
        cover_image_url = null;
      }

      const { error } = await (supabase.from('universes') as any).update({
        title: tT,
        description: dT || null,
        cover_image_url,
      }).eq('id', universe.id);
      if (error) throw error;
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
    return groups;
  }, [stories]);

  const unassignedStories = useMemo(
    () => stories.filter((story) => !story.arc_id),
    [stories],
  );

  const editUniverseViolations = validateUniverseFields(editTitle.trim(), editDescription.trim());
  const editUniverseOverLimit = editUniverseViolations.length > 0;

  const arcViolations = validateArcFields(arcName.trim(), arcDescription.trim());
  const arcOverLimit = arcViolations.length > 0;

  if (loading && !universe) return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-20 text-center text-muted-foreground">{t('common.loading')}</div>
    </div>
  );

  if (!universe) return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-20 text-center text-muted-foreground">{t('universe.notFound')}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container max-w-6xl overflow-x-hidden py-8 max-sm:py-6 animate-fade-in">
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
          <div className="mb-8">
            {universe.cover_image_url && (
              <div className="mb-4 aspect-[16/9] w-full overflow-hidden rounded-xl border border-border [-webkit-touch-callout:none]">
                <img src={universe.cover_image_url} alt={universe.title} className="h-full w-full object-cover" />
              </div>
            )}
            <div className="flex flex-col gap-4 max-sm:gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 max-sm:items-start">
                  <Globe className="h-5 w-5 shrink-0 text-primary max-sm:mt-0.5" aria-hidden />
                  <h1 className="text-balance break-words text-2xl font-bold font-serif leading-tight sm:text-3xl">{universe.title}</h1>
                </div>
                {universe.description && (
                  <p className="mt-1 whitespace-pre-wrap break-words text-pretty leading-relaxed text-muted-foreground max-sm:text-sm">
                    {universe.description}
                  </p>
                )}
              </div>
              <div className="flex w-full shrink-0 flex-wrap items-center gap-2 max-sm:flex-nowrap max-sm:flex-col sm:w-auto sm:justify-end">
                {!isOwner && user && (
                  <Button type="button" variant="outline" size="sm" onClick={toggleFollow} className="max-sm:h-11 max-sm:w-full max-sm:flex-initial max-sm:touch-manipulation sm:shrink-0">
                    {following ? t('universe.unfollow') : t('universe.follow')}
                  </Button>
                )}
                {isOwner && (
                  <Button type="button" variant="ghost" size="sm" onClick={startEditing} className="max-sm:h-11 max-sm:w-full max-sm:flex-initial max-sm:justify-center max-sm:border max-sm:border-border max-sm:bg-card max-sm:touch-manipulation sm:shrink-0">
                    <Pencil className="mr-1 h-4 w-4 shrink-0 max-sm:inline" aria-hidden /> {t('common.edit')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        <section className="mb-10">
          <div className="mb-4 flex items-center justify-between gap-4 max-sm:flex-col max-sm:items-stretch">
            <h2 className="text-lg font-semibold leading-snug">{t('universe.arcs')}</h2>
            {isOwner && (
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

          {showArcForm && isOwner && (
            <div className="mb-6 space-y-4 rounded-lg border border-border bg-card p-4 max-sm:p-3 max-sm:shadow-sm">
              <div className="flex items-center justify-between gap-3 max-sm:items-start max-sm:border-b max-sm:border-border max-sm:pb-3">
                <h3 className="min-w-0 font-semibold leading-snug">{editingArcId ? t('universe.editArc') : t('universe.newArc')}</h3>
                <Button variant="ghost" size="sm" type="button" className="max-sm:h-10 max-sm:w-10 max-sm:shrink-0 max-sm:p-0 max-sm:touch-manipulation" onClick={resetArcForm} aria-label={t('common.cancel')}>
                  <X className="h-4 w-4" aria-hidden />
                </Button>
              </div>
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
            </div>
          )}

          {arcs.length === 0 ? (
            <p className="text-muted-foreground">{t('universe.noArcs')}</p>
          ) : (
            <div className="space-y-6">
              {arcs.map((arc) => {
                const arcStories = arcStoryMap.get(arc.id) || [];
                return (
                  <div key={arc.id} className="overflow-hidden rounded-xl border border-border bg-card max-sm:shadow-sm">
                    {arc.cover_image_url && (
                      <div className="aspect-[16/5] overflow-hidden border-b border-border [-webkit-touch-callout:none] max-sm:aspect-[16/6]">
                        <img src={arc.cover_image_url} alt="" className="h-full w-full object-cover" />
                      </div>
                    )}
                    <div className="space-y-4 p-4 max-sm:p-3">
                      <div className="flex items-start justify-between gap-3 max-sm:flex-col max-sm:gap-4">
                        <div className="min-w-0 flex-1 space-y-2">
                          <p className="mb-1 break-words text-xs uppercase tracking-wide text-primary">{t(`arcType.${arc.type}` as TranslationKey)}</p>
                          <h3 className="text-balance text-xl font-semibold leading-snug">{arc.name}</h3>
                          {arc.description && (
                            <p className="whitespace-pre-wrap break-words text-pretty text-sm leading-relaxed text-muted-foreground">
                              {arc.description}
                            </p>
                          )}
                        </div>
                        {isOwner && (
                          <div className="flex w-full shrink-0 gap-2 max-sm:grid max-sm:grid-cols-2 max-sm:flex-none sm:w-auto">
                            <Button type="button" variant="ghost" size="sm" className="max-sm:h-11 max-sm:border max-sm:border-border max-sm:bg-background max-sm:touch-manipulation" onClick={() => startEditingArc(arc)}>
                              <Pencil className="mr-1 h-4 w-4 shrink-0" aria-hidden /> {t('common.edit')}
                            </Button>
                            <Button type="button" variant="ghost" size="sm" className="max-sm:h-11 max-sm:border max-sm:border-border max-sm:bg-background max-sm:text-destructive max-sm:touch-manipulation hover:text-destructive" onClick={() => deleteArc(arc.id)}>
                              <X className="mr-1 h-4 w-4 shrink-0" aria-hidden /> {t('common.delete')}
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="border-t border-border pt-4">
                        {arcStories.length === 0 ? (
                          <p className="text-sm text-muted-foreground max-sm:leading-relaxed">{t('universe.arcStoriesEmpty')}</p>
                        ) : (
                          <UniverseStoriesShelf stories={arcStories} />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mb-6">
          <div className="mb-4 flex items-center justify-between gap-4 max-sm:flex-col max-sm:items-stretch">
            <h2 className="text-lg font-semibold leading-snug">{t('universe.stories')}</h2>
            {isOwner && (
              <Button asChild size="sm" className="max-sm:h-11 max-sm:w-full max-sm:flex-initial max-sm:justify-center max-sm:touch-manipulation gradient-warm text-primary-foreground sm:shrink-0">
                <Link href={`/universe/${id}/create-story`} className="inline-flex items-center justify-center gap-1">
                  <Plus className="h-4 w-4 shrink-0" aria-hidden /> {t('universe.newStory')}
                </Link>
              </Button>
            )}
          </div>

          <div className="mb-6 flex flex-wrap gap-2 max-sm:-mx-1 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:snap-x max-sm:snap-mandatory max-sm:pb-2 [-ms-overflow-style:none] max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden">
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
              {isOwner && (
                <Button asChild className="mt-4 gradient-warm text-primary-foreground max-sm:mx-auto max-sm:h-11 max-sm:w-full max-sm:max-w-sm max-sm:touch-manipulation">
                  <Link href={`/universe/${id}/create-story`}>{t('universe.createFirst')}</Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-4 max-sm:p-3 max-sm:shadow-sm">
              <h3 className="mb-4 break-words text-balance font-semibold">{t('universe.storiesWithoutArc')}</h3>
              {unassignedStories.length === 0 ? (
                <p className="text-sm text-muted-foreground max-sm:leading-relaxed">{t('universe.noStoriesWithoutArc')}</p>
              ) : (
                <UniverseStoriesShelf stories={unassignedStories} />
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
