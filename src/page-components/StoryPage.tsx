import { useState, useEffect, useRef } from 'react';
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import Header from '@/components/Header';
import { Heart, MessageCircle, Plus, BookOpen, Pencil, X, ImagePlus, FileText, Image, Layers, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import TagInput from '@/components/TagInput';
import ComicPageUploader from '@/components/ComicPageUploader';
import IllustratedBlockEditor, { type IllustratedBlockItem } from '@/components/IllustratedBlockEditor';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';
import type { TranslationKey } from '@/i18n/translations';

type StoryWithProfile = Tables<'stories'> & { profiles: { username: string } | null };
type CommentWithProfile = Tables<'comments'> & { profiles: { username: string } | null };
type Arc = Tables<'arcs'>;

export default function StoryPage() {
  const { id } = useParams<{ id: string }>() as { id: string };
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [story, setStory] = useState<StoryWithProfile | null>(null);
  const [storyArc, setStoryArc] = useState<Arc | null>(null);
  const [availableArcs, setAvailableArcs] = useState<Arc[]>([]);
  const [chapters, setChapters] = useState<Tables<'chapters'>[]>([]);
  const [comicPages, setComicPages] = useState<any[]>([]);
  const [illustratedBlocks, setIllustratedBlocks] = useState<any[]>([]);
  const [comments, setComments] = useState<CommentWithProfile[]>([]);
  const [liked, setLiked] = useState(false);
  const [comment, setComment] = useState('');
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterContent, setChapterContent] = useState('');
  const [addingChapter, setAddingChapter] = useState(false);

  // Content editing state
  const [editingContent, setEditingContent] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editComicPages, setEditComicPages] = useState<any[]>([]);
  const [editIllustratedBlocks, setEditIllustratedBlocks] = useState<IllustratedBlockItem[]>([]);
  const [savingContent, setSavingContent] = useState(false);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editCoverPreview, setEditCoverPreview] = useState<string | null>(null);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editArcId, setEditArcId] = useState('');
  const [saving, setSaving] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (id) fetchAll(); }, [id, user]);

  const fetchAll = async () => {
    const storyRes = await supabase.from('stories').select('*').eq('id', id!).single();

    if (storyRes.data) {
      const storyData = storyRes.data as any;
      const { data: authorProfile } = await supabase.from('profiles').select('username').eq('user_id', storyData.author_id).single();
      setStory({ ...storyData, profiles: authorProfile } as StoryWithProfile);
      if (storyData.universe_id) {
        const { data: arcsData } = await supabase.from('arcs').select('*').eq('universe_id', storyData.universe_id).order('created_at', { ascending: false });
        setAvailableArcs(arcsData || []);
        setStoryArc((arcsData || []).find((arc) => arc.id === storyData.arc_id) || null);
      } else {
        setAvailableArcs([]);
        setStoryArc(null);
      }

      // Fetch type-specific content
      if (storyData.type === 'chapters' || !storyData.type) {
        const { data } = await supabase.from('chapters').select('*').eq('story_id', id!).order('chapter_number');
        setChapters(data || []);
      }

      if (storyData.type === 'comic') {
        const { data } = await (supabase.from('comic_pages') as any).select('*').eq('story_id', id!).order('page_order');
        setComicPages(data || []);
      }

      if (storyData.type === 'illustrated') {
        const { data } = await (supabase.from('illustrated_blocks') as any).select('*').eq('story_id', id!).order('block_order');
        setIllustratedBlocks(data || []);
      }
    }

    const commentsRes = await supabase.from('comments').select('*').eq('story_id', id!).order('created_at', { ascending: false });
    if (commentsRes.data) {
      const userIds = [...new Set(commentsRes.data.map(c => c.user_id))];
      const { data: profiles } = await supabase.from('profiles').select('user_id, username').in('user_id', userIds);
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      setComments(commentsRes.data.map(c => ({ ...c, profiles: profileMap.get(c.user_id) || null })) as CommentWithProfile[]);
    }

    if (user) {
      const { data } = await supabase.from('likes').select('*').eq('story_id', id!).eq('user_id', user.id).maybeSingle();
      setLiked(!!data);
    }
  };

  const toggleLike = async () => {
    if (!user) { toast({ title: t('story.loginToLike'), variant: 'destructive' }); return; }
    if (liked) {
      await supabase.from('likes').delete().eq('story_id', id!).eq('user_id', user.id);
    } else {
      await supabase.from('likes').insert({ story_id: id!, user_id: user.id });
    }
    setLiked(!liked);
    fetchAll();
  };

  const addComment = async () => {
    if (!user || !comment.trim()) return;
    await supabase.from('comments').insert({ story_id: id!, user_id: user.id, content: comment.trim() });
    setComment('');
    fetchAll();
  };

  const addChapter = async () => {
    if (!chapterTitle.trim()) return;
    setAddingChapter(true);
    const nextNum = chapters.length + 1;
    const { error } = await supabase.from('chapters').insert({
      story_id: id!,
      title: chapterTitle,
      content: chapterContent,
      chapter_number: nextNum,
    });
    if (error) { toast({ title: t('common.error'), description: error.message, variant: 'destructive' }); }
    else { setChapterTitle(''); setChapterContent(''); setShowAddChapter(false); fetchAll(); }
    setAddingChapter(false);
  };

  const startEditing = () => {
    if (!story) return;
    setEditTitle(story.title);
    setEditDescription(story.description || '');
    setEditCoverPreview(story.cover_image_url || null);
    setEditCoverFile(null);
    setEditTags((story as any).tags || []);
    setEditArcId(story.arc_id || '');
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditCoverFile(null);
    if (editCoverPreview && editCoverPreview !== story?.cover_image_url) {
      URL.revokeObjectURL(editCoverPreview);
    }
    setEditCoverPreview(null);
  };

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: t('story.imageTooLarge'), description: t('story.max5mb'), variant: 'destructive' });
      return;
    }
    setEditCoverFile(file);
    setEditCoverPreview(URL.createObjectURL(file));
  };

  const removeCover = () => {
    setEditCoverFile(null);
    setEditCoverPreview(null);
    if (coverInputRef.current) coverInputRef.current.value = '';
  };

  const saveEdits = async () => {
    if (!story || !user || !editTitle.trim()) return;
    setSaving(true);
    try {
      let cover_image_url = story.cover_image_url;
      if (editCoverFile) {
        const ext = editCoverFile.name.split('.').pop();
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('covers').upload(path, editCoverFile);
        if (uploadErr) throw uploadErr;
        const { data } = supabase.storage.from('covers').getPublicUrl(path);
        cover_image_url = data.publicUrl;
      } else if (!editCoverPreview) {
        cover_image_url = null;
      }

      const { error } = await supabase.from('stories').update({
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        cover_image_url,
        tags: editTags,
        arc_id: editArcId || null,
      } as any).eq('id', story.id);

      if (error) throw error;
      toast({ title: t('story.updated') });
      setEditing(false);
      fetchAll();
    } catch (err: any) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Content editing helpers
  const startEditingContent = () => {
    if (!story) return;
    const type = (story as any).type || 'chapters';
    if (type === 'short_story') {
      setEditContent((story as any).content || '');
    } else if (type === 'comic') {
      setEditComicPages(comicPages.map(p => ({ id: p.id, preview: p.image_url, image_url: p.image_url })));
    } else if (type === 'illustrated') {
      setEditIllustratedBlocks(illustratedBlocks.map(b => ({
        id: b.id,
        block_type: b.block_type as 'text' | 'image',
        content: b.content,
        preview: b.block_type === 'image' ? b.content : undefined,
      })));
    }
    setEditingContent(true);
  };

  const cancelEditingContent = () => {
    setEditingContent(false);
    editComicPages.forEach(p => { if (p.file) URL.revokeObjectURL(p.preview); });
    editIllustratedBlocks.forEach(b => { if (b.file && b.preview) URL.revokeObjectURL(b.preview); });
  };

  const saveContent = async () => {
    if (!story || !user) return;
    setSavingContent(true);
    try {
      const type = (story as any).type || 'chapters';

      if (type === 'short_story') {
        const { error } = await supabase.from('stories').update({ content: editContent } as any).eq('id', story.id);
        if (error) throw error;
      }

      if (type === 'comic') {
        // Delete old pages
        await (supabase.from('comic_pages') as any).delete().eq('story_id', story.id);
        // Upload new / re-insert existing
        for (let i = 0; i < editComicPages.length; i++) {
          const page = editComicPages[i];
          let image_url = page.image_url;
          if (page.file) {
            const ext = page.file.name.split('.').pop();
            const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
            const { error: upErr } = await supabase.storage.from('comics').upload(path, page.file);
            if (upErr) throw upErr;
            image_url = supabase.storage.from('comics').getPublicUrl(path).data.publicUrl;
          }
          await (supabase.from('comic_pages') as any).insert({ story_id: story.id, image_url, page_order: i + 1 });
        }
      }

      if (type === 'illustrated') {
        // Delete old blocks
        await (supabase.from('illustrated_blocks') as any).delete().eq('story_id', story.id);
        // Insert new blocks
        for (let i = 0; i < editIllustratedBlocks.length; i++) {
          const block = editIllustratedBlocks[i];
          let content = block.content;
          if (block.block_type === 'image' && block.file) {
            const ext = block.file.name.split('.').pop();
            const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
            const { error: upErr } = await supabase.storage.from('comics').upload(path, block.file);
            if (upErr) throw upErr;
            content = supabase.storage.from('comics').getPublicUrl(path).data.publicUrl;
          }
          await (supabase.from('illustrated_blocks') as any).insert({
            story_id: story.id, block_type: block.block_type, content, block_order: i + 1,
          });
        }
      }

      toast({ title: t('story.contentUpdated') });
      setEditingContent(false);
      fetchAll();
    } catch (err: any) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    } finally {
      setSavingContent(false);
    }
  };

  if (!story) return <div className="min-h-screen bg-background"><Header /><div className="container py-20 text-center text-muted-foreground">{t('common.loading')}</div></div>;

  const isAuthor = user?.id === story.author_id;
  const storyType = (story as any).type || 'chapters';

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 max-w-2xl animate-fade-in">
        {/* Story header */}
        <div className="mb-8">
          {editing ? (
            <div className="space-y-4 p-4 rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{t('story.editStory')}</h2>
                <Button variant="ghost" size="sm" onClick={cancelEditing}><X className="h-4 w-4" /></Button>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">{t('story.cover')}</label>
                <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverSelect} className="hidden" />
                {editCoverPreview ? (
                  <div className="relative w-full aspect-[3/4] max-w-[200px] rounded-lg overflow-hidden border border-border">
                    <img src={editCoverPreview} alt="Preview" className="w-full h-full object-cover" />
                    <button type="button" onClick={removeCover} className="absolute top-2 right-2 p-1 rounded-full bg-background/80 hover:bg-background text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => coverInputRef.current?.click()} className="flex flex-col items-center justify-center w-full aspect-[3/4] max-w-[200px] rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors bg-muted/30">
                    <ImagePlus className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-xs text-muted-foreground">{t('story.addCover')}</span>
                  </button>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">{t('story.title')}</label>
                <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">{t('story.description')}</label>
                <Textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={4} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">{t('story.tags')}</label>
                <TagInput tags={editTags} onChange={setEditTags} />
              </div>
              {story.universe_id && (
                <div>
                  <label className="text-sm font-medium text-foreground">{t('story.arc')}</label>
                  <select
                    value={editArcId}
                    onChange={e => setEditArcId(e.target.value)}
                    className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    <option value="">{t('common.none')}</option>
                    {availableArcs.map((arc) => (
                      <option key={arc.id} value={arc.id}>{arc.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={saveEdits} disabled={saving || !editTitle.trim()} size="sm" className="gradient-warm text-primary-foreground">
                  {saving ? t('common.saving') : t('common.save')}
                </Button>
                <Button variant="outline" size="sm" onClick={cancelEditing}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <>
              {story.cover_image_url && (
                <div className="mb-4 w-full max-w-[200px] aspect-[3/4] rounded-lg overflow-hidden border border-border">
                  <img src={story.cover_image_url} alt={story.title} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Badge variant="outline" className="mb-2 text-xs">{t((`typeLabel.${storyType}`) as TranslationKey)}</Badge>
                  <h1 className="text-3xl font-bold font-serif mb-2">{story.title}</h1>
                </div>
                {isAuthor && (
                  <Button variant="ghost" size="sm" onClick={startEditing} className="shrink-0">
                    <Pencil className="h-4 w-4 mr-1" /> Editar
                  </Button>
                )}
              </div>
              <p className="text-muted-foreground text-sm">{t('common.by')} {story.profiles?.username || t('common.anonymous')}</p>
              {storyArc && <p className="text-sm text-muted-foreground mt-1">{t('story.arc')}: {storyArc.name}</p>}
              {story.description && <p className="mt-3 text-foreground/80">{story.description}</p>}
              {(story as any).tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {(story as any).tags.map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-4 mt-4">
                <Button variant={liked ? 'default' : 'outline'} size="sm" onClick={toggleLike} className={liked ? 'gradient-warm text-primary-foreground' : ''}>
                  <Heart className={`h-4 w-4 mr-1 ${liked ? 'fill-current' : ''}`} /> {story.likes_count}
                </Button>
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MessageCircle className="h-4 w-4" /> {story.comments_count}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Content by type */}
        {storyType === 'short_story' && (
          <section className="mb-8">
            {editingContent ? (
              <div className="space-y-3 p-4 rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{t('story.editContent')}</h2>
                  <Button variant="ghost" size="sm" onClick={cancelEditingContent}><X className="h-4 w-4" /></Button>
                </div>
                <Textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={12} className="font-serif" />
                <div className="flex gap-2">
                  <Button onClick={saveContent} disabled={savingContent} size="sm" className="gradient-warm text-primary-foreground">
                    <Save className="h-4 w-4 mr-1" /> {savingContent ? t('common.saving') : t('common.save')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={cancelEditingContent}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <>
                {isAuthor && (
                  <div className="flex justify-end mb-2">
                    <Button variant="ghost" size="sm" onClick={startEditingContent}>
                      <Pencil className="h-4 w-4 mr-1" /> Editar conteúdo
                    </Button>
                  </div>
                )}
                <div className="prose prose-sm max-w-none font-serif leading-relaxed text-foreground/90 whitespace-pre-wrap">
                  {(story as any).content || <p className="text-muted-foreground italic">{t('common.noContent')}</p>}
                </div>
              </>
            )}
          </section>
        )}

        {(storyType === 'chapters' || !storyType) && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{t('story.chapters')}</h2>
              {isAuthor && (
                <Button size="sm" variant="outline" onClick={() => setShowAddChapter(!showAddChapter)}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
              )}
            </div>
            {showAddChapter && (
              <div className="space-y-3 mb-4 p-4 rounded-lg border border-border bg-card">
                <Input placeholder={t('story.chapterTitlePlaceholder')} value={chapterTitle} onChange={e => setChapterTitle(e.target.value)} />
                <Textarea placeholder={t('story.chapterContentPlaceholder')} value={chapterContent} onChange={e => setChapterContent(e.target.value)} rows={8} />
                <Button onClick={addChapter} disabled={addingChapter} size="sm" className="gradient-warm text-primary-foreground">
                  {addingChapter ? t('common.saving') : t('story.saveChapter')}
                </Button>
              </div>
            )}
            {chapters.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t('story.noChapters')}</p>
            ) : (
              <div className="space-y-2">
                {chapters.map(ch => (
                  <Link key={ch.id} href={`/story/${id}/chapter/${ch.chapter_number}`} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent transition-colors">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Cap. {ch.chapter_number}: {ch.title}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {storyType === 'comic' && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{t('story.pages')}</h2>
              {isAuthor && !editingContent && (
                <Button variant="ghost" size="sm" onClick={startEditingContent}>
                  <Pencil className="h-4 w-4 mr-1" /> Editar páginas
                </Button>
              )}
            </div>
            {editingContent ? (
              <div className="space-y-3 p-4 rounded-lg border border-border bg-card">
                <ComicPageUploader pages={editComicPages} onChange={setEditComicPages} />
                <div className="flex gap-2 pt-2">
                  <Button onClick={saveContent} disabled={savingContent} size="sm" className="gradient-warm text-primary-foreground">
                    <Save className="h-4 w-4 mr-1" /> {savingContent ? t('common.saving') : t('common.save')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={cancelEditingContent}>Cancelar</Button>
                </div>
              </div>
            ) : comicPages.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t('story.noPages')}</p>
            ) : (
              <div className="space-y-4">
                {comicPages.map((page: any, i: number) => (
                  <div key={page.id || i} className="rounded-lg overflow-hidden border border-border">
                    <img src={page.image_url} alt={`${t('story.page')} ${i + 1}`} className="w-full object-contain" loading="lazy" />
                    <div className="text-center text-xs text-muted-foreground py-1 bg-muted/30">
                      {t('story.page')} {page.page_order}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {storyType === 'illustrated' && (
          <section className="mb-8">
            {editingContent ? (
              <div className="space-y-3 p-4 rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{t('story.editBlocks')}</h2>
                  <Button variant="ghost" size="sm" onClick={cancelEditingContent}><X className="h-4 w-4" /></Button>
                </div>
                <IllustratedBlockEditor blocks={editIllustratedBlocks} onChange={setEditIllustratedBlocks} />
                <div className="flex gap-2 pt-2">
                  <Button onClick={saveContent} disabled={savingContent} size="sm" className="gradient-warm text-primary-foreground">
                    <Save className="h-4 w-4 mr-1" /> {savingContent ? t('common.saving') : t('common.save')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={cancelEditingContent}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <>
                {isAuthor && (
                  <div className="flex justify-end mb-2">
                    <Button variant="ghost" size="sm" onClick={startEditingContent}>
                      <Pencil className="h-4 w-4 mr-1" /> Editar blocos
                    </Button>
                  </div>
                )}
                {illustratedBlocks.length === 0 ? (
                  <p className="text-muted-foreground text-sm">{t('common.noContent')}</p>
                ) : (
                  <div className="space-y-6">
                    {illustratedBlocks.map((block: any, i: number) => (
                      <div key={block.id || i}>
                        {block.block_type === 'text' ? (
                          <div className="prose prose-sm max-w-none font-serif leading-relaxed text-foreground/90 whitespace-pre-wrap">
                            {block.content}
                          </div>
                        ) : (
                          <div className="rounded-lg overflow-hidden border border-border">
                            <img src={block.content} alt={`${t('story.illustration')} ${i + 1}`} className="w-full object-contain" loading="lazy" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* Comments */}
        <section>
          <h2 className="text-lg font-semibold mb-4">{t('story.comments')}</h2>
          {user && (
            <div className="flex gap-2 mb-4">
              <Textarea placeholder={t('story.commentPlaceholder')} value={comment} onChange={e => setComment(e.target.value)} rows={2} className="flex-1" />
              <Button onClick={addComment} size="sm" disabled={!comment.trim()}>{t('common.send')}</Button>
            </div>
          )}
          {comments.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('story.noComments')}</p>
          ) : (
            <div className="space-y-3">
              {comments.map(c => (
                <div key={c.id} className="p-3 rounded-lg border border-border bg-card">
                  <p className="text-xs font-medium text-primary">{c.profiles?.username || t('common.anonymous')}</p>
                  <p className="text-sm mt-1">{c.content}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
