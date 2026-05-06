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
import StoryCard from '@/components/StoryCard';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, X, ImagePlus, FileText, BookOpen, Image, Layers, Globe, Save } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';
import type { TranslationKey } from '@/i18n/translations';

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
    if (!user || !universe || !arcName.trim()) return;
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
          name: arcName.trim(),
          description: arcDescription.trim() || null,
          type: arcType,
          cover_image_url,
        }).eq('id', editingArcId);
        if (error) throw error;
        toast({ title: t('universe.arcUpdated') });
      } else {
        const { error } = await supabase.from('arcs').insert({
          universe_id: universe.id,
          name: arcName.trim(),
          description: arcDescription.trim() || null,
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
        title: editTitle.trim(),
        description: editDescription.trim() || null,
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
      <main className="container py-8 max-w-6xl animate-fade-in">
        {editing ? (
          <div className="space-y-4 p-4 rounded-lg border border-border bg-card mb-8">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('universe.editUniverse')}</h2>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}><X className="h-4 w-4" /></Button>
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
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">{t('createUniverse.descLabel')}</label>
              <Textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={4} />
            </div>
            <div className="flex gap-2">
              <Button onClick={saveEdits} disabled={saving || !editTitle.trim()} size="sm" className="gradient-warm text-primary-foreground">
                <Save className="h-4 w-4 mr-1" /> {saving ? t('common.saving') : t('common.save')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>{t('common.cancel')}</Button>
            </div>
          </div>
        ) : (
          <div className="mb-8">
            {universe.cover_image_url && (
              <div className="w-full aspect-[16/9] rounded-xl overflow-hidden border border-border mb-4">
                <img src={universe.cover_image_url} alt={universe.title} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="h-5 w-5 text-primary" />
                  <h1 className="text-2xl font-bold font-serif">{universe.title}</h1>
                </div>
                {universe.description && <p className="text-muted-foreground mt-1">{universe.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                {!isOwner && user && (
                  <Button variant="outline" size="sm" onClick={toggleFollow} className="shrink-0">
                    {following ? t('universe.unfollow') : t('universe.follow')}
                  </Button>
                )}
                {isOwner && (
                  <Button variant="ghost" size="sm" onClick={startEditing} className="shrink-0">
                    <Pencil className="h-4 w-4 mr-1" /> {t('common.edit')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{t('universe.arcs')}</h2>
            {isOwner && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (showArcForm && !editingArcId) {
                    resetArcForm();
                  } else {
                    resetArcForm();
                    setShowArcForm(true);
                  }
                }}
              >
                <Plus className="h-4 w-4 mr-1" /> {t('universe.newArc')}
              </Button>
            )}
          </div>

          {showArcForm && isOwner && (
            <div className="space-y-4 p-4 rounded-lg border border-border bg-card mb-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{editingArcId ? t('universe.editArc') : t('universe.newArc')}</h3>
                <Button variant="ghost" size="sm" onClick={resetArcForm}><X className="h-4 w-4" /></Button>
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
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">{t('universe.arcDescription')}</label>
                <Textarea value={arcDescription} onChange={(e) => setArcDescription(e.target.value)} rows={3} />
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
              <div className="flex gap-2">
                <Button onClick={saveArc} disabled={savingArc || !arcName.trim()} size="sm" className="gradient-warm text-primary-foreground">
                  {savingArc ? t('common.saving') : t('common.save')}
                </Button>
                <Button variant="outline" size="sm" onClick={resetArcForm}>{t('common.cancel')}</Button>
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
                  <div key={arc.id} className="rounded-xl border border-border bg-card overflow-hidden">
                    {arc.cover_image_url && (
                      <div className="aspect-[16/5] overflow-hidden border-b border-border">
                        <img src={arc.cover_image_url} alt={arc.name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-primary mb-1">{t(`arcType.${arc.type}` as TranslationKey)}</p>
                          <h3 className="text-xl font-semibold">{arc.name}</h3>
                          {arc.description && <p className="text-sm text-muted-foreground mt-2">{arc.description}</p>}
                        </div>
                        {isOwner && (
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => startEditingArc(arc)}>
                              <Pencil className="h-4 w-4 mr-1" /> {t('common.edit')}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => deleteArc(arc.id)}>
                              <X className="h-4 w-4 mr-1" /> {t('common.delete')}
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="mt-4">
                        {arcStories.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{t('universe.arcStoriesEmpty')}</p>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {arcStories.map((story) => <StoryCard key={story.id} story={story} />)}
                          </div>
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{t('universe.stories')}</h2>
            {isOwner && (
              <Button asChild size="sm" className="gradient-warm text-primary-foreground">
                <Link href={`/universe/${id}/create-story`}><Plus className="h-4 w-4 mr-1" /> {t('universe.newStory')}</Link>
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setActiveType(null)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1 ${!activeType ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground'}`}
            >
              {t('common.all')}
            </button>
            {TYPE_FILTERS.map(tf => (
              <button
                key={tf.value}
                onClick={() => setActiveType(activeType === tf.value ? null : tf.value)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1 ${activeType === tf.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground'}`}
              >
                {tf.icon} {t(tf.labelKey)}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-muted-foreground text-center">{t('common.loading')}</p>
          ) : stories.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">{t('universe.noStories')}</p>
              {isOwner && (
                <Button asChild className="mt-4 gradient-warm text-primary-foreground">
                  <Link href={`/universe/${id}/create-story`}>{t('universe.createFirst')}</Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="font-semibold mb-4">{t('universe.storiesWithoutArc')}</h3>
              {unassignedStories.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('universe.noStoriesWithoutArc')}</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {unassignedStories.map((story) => <StoryCard key={story.id} story={story} />)}
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
