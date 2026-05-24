import { useState, useEffect, useRef } from 'react';
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  createChapter,
  getComicPages,
  getProfileByUserId,
  getStoryById,
  getStoryChapters,
  getUniverseArcs,
  replaceComicPages,
  updateStory,
} from '@/lib/api';
import {
  createComment,
  getLikeStatus,
  getStoryComments,
  toggleLike,
} from '@/lib/api/social';
import { uploadFile } from '@/lib/api/storage';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import Header from '@/components/Header';
import PreviousScreenBackButton from '@/components/PreviousScreenBackButton';
import { Heart, MessageCircle, Plus, BookOpen, Pencil, X, ImagePlus, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import TagInput from '@/components/TagInput';
import ComicPageUploader from '@/components/ComicPageUploader';
import IllustratedBlockEditor, { type IllustratedBlockItem } from '@/components/IllustratedBlockEditor';
import CharacterMeter from '@/components/CharacterMeter';
import { useToast } from '@/hooks/use-toast';
import {
  CONTENT_LIMITS,
  describeViolations,
  shortStoryBlocksEmpty,
  validateChapterTitle,
  validateShortStoryBlocks,
  validateStoryMeta,
} from '@/lib/contentLimits';
import {
  blockHasContent,
  blocksFromLegacyPlainText,
  blocksToEditorItems,
  loadBlocks,
  normalizeStoryType,
  saveBlocks,
} from '@/lib/storyBlocks';
import StoryBlocksView from '@/components/StoryBlocksView';
import type { Tables } from '@/integrations/supabase/types';
import type { TranslationKey } from '@/i18n/translations';
import { clearChapterReturnStoryId, markChapterOpenedFromStory } from '@/lib/storyChapterNav';

type StoryWithProfile = Tables<'stories'> & { profiles: { username: string } | null };
type CommentWithProfile = Tables<'comments'> & { profiles: { username: string } | null };
type Arc = Tables<'arcs'>;

export type StoryPageProps = {
  /** Render without site header; used inside feed exploration full surface. */
  embedExploration?: boolean;
  storyIdOverride?: string;
  /** Open a chapter inside the feed exploration stack instead of leaving for a canonical route. */
  explorationOpenChapter?: (chapterNum: number) => void;
};

export default function StoryPage({
  embedExploration = false,
  storyIdOverride,
  explorationOpenChapter,
}: StoryPageProps = {}) {
  const params = useParams<{ id: string }>();
  const id = (storyIdOverride ?? params?.id) as string | undefined;
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [story, setStory] = useState<StoryWithProfile | null>(null);
  const [storyArc, setStoryArc] = useState<Arc | null>(null);
  const [availableArcs, setAvailableArcs] = useState<Arc[]>([]);
  const [chapters, setChapters] = useState<Tables<'chapters'>[]>([]);
  const [comicPages, setComicPages] = useState<any[]>([]);
  const [shortStoryBlocks, setShortStoryBlocks] = useState<any[]>([]);
  const [comments, setComments] = useState<CommentWithProfile[]>([]);
  const [liked, setLiked] = useState(false);
  const [comment, setComment] = useState('');
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterBlocks, setChapterBlocks] = useState<IllustratedBlockItem[]>([]);
  const [addingChapter, setAddingChapter] = useState(false);

  // Content editing state
  const [editingContent, setEditingContent] = useState(false);
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

  useEffect(() => {
    if (id) fetchAll();
  }, [id, user]);

  useEffect(() => {
    if (!embedExploration && id) clearChapterReturnStoryId();
  }, [embedExploration, id]);

  const fetchAll = async () => {
    if (!id) return;
    try {
      const storyData = await getStoryById(id);
      const authorProfile = await getProfileByUserId(storyData.author_id);
      setStory({
        ...storyData,
        profiles: authorProfile ? { username: authorProfile.username } : null,
      } as StoryWithProfile);

      if (storyData.universe_id) {
        const arcsData = await getUniverseArcs(storyData.universe_id);
        const sorted = [...arcsData].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        setAvailableArcs(sorted as Arc[]);
        setStoryArc((sorted as Arc[]).find((arc) => arc.id === storyData.arc_id) || null);
      } else {
        setAvailableArcs([]);
        setStoryArc(null);
      }

      if (normalizeStoryType(storyData.type) === 'chapters') {
        setChapters((await getStoryChapters(id)) as Tables<'chapters'>[]);
      } else {
        setChapters([]);
      }

      if (storyData.type === 'comic') {
        setComicPages((await getComicPages(id)) as Tables<'comic_pages'>[]);
      } else {
        setComicPages([]);
      }

      if (storyData.type === 'short_story') {
        setShortStoryBlocks(await loadBlocks(id, null));
      } else {
        setShortStoryBlocks([]);
      }

      const commentRows = await getStoryComments(id);
      setComments(
        commentRows.map((c) => ({
          ...c,
          profiles: c.username ? { username: c.username } : null,
        })) as CommentWithProfile[],
      );

      if (user) {
        const { liked: isLiked } = await getLikeStatus(id);
        setLiked(isLiked);
      } else {
        setLiked(false);
      }
    } catch {
      setStory(null);
    }
  };

  const toggleLikeHandler = async () => {
    if (!user || !user) {
      toast({ title: t('story.loginToLike'), variant: 'destructive' });
      return;
    }
    const { liked: isLiked } = await toggleLike(id!);
    setLiked(isLiked);
    fetchAll();
  };

  const addComment = async () => {
    if (!user || !user || !comment.trim()) return;
    await createComment(id!, comment.trim());
    setComment('');
    fetchAll();
  };

  const addChapter = async () => {
    const chTitle = chapterTitle.trim();
    if (!chTitle) return;
    const chV = validateChapterTitle(chTitle);
    if (chV.length) {
      toast({
        title: t('validation.charLimitsTitle'),
        description: describeViolations(t, chV),
        variant: 'destructive',
      });
      return;
    }
    setAddingChapter(true);
    try {
      if (!user) throw new Error('Not authenticated');
      const chapterRow = await createChapter(id!, chTitle);
      if (chapterBlocks.some(blockHasContent)) {
        await saveBlocks(id!, chapterRow.id, chapterBlocks, user!.id);
      }
      setChapterTitle('');
      setChapterBlocks([]);
      setShowAddChapter(false);
      fetchAll();
    } catch (err: any) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    }
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
    const titleT = editTitle.trim();
    const descT = editDescription.trim();
    const mv = validateStoryMeta(titleT, descT);
    if (mv.length) {
      toast({
        title: t('validation.charLimitsTitle'),
        description: describeViolations(t, mv),
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      let cover_image_url = story.cover_image_url;
      if (!user) throw new Error('Not authenticated');
      if (editCoverFile) {
        const ext = editCoverFile.name.split('.').pop();
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        cover_image_url = await uploadFile('covers', editCoverFile, path);
      } else if (!editCoverPreview) {
        cover_image_url = null;
      }

      await updateStory(story.id, {
        title: titleT,
        description: descT || null,
        cover_image_url,
        tags: editTags,
        arc_id: editArcId || null,
      });
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
    const type = normalizeStoryType((story as any).type);
    if (type === 'short_story') {
      const items =
        shortStoryBlocks.length > 0
          ? blocksToEditorItems(shortStoryBlocks)
          : blocksFromLegacyPlainText((story as any).content || '');
      setEditIllustratedBlocks(items);
    } else if (type === 'comic') {
      setEditComicPages(comicPages.map(p => ({ id: p.id, preview: p.image_url, image_url: p.image_url })));
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
    const type = normalizeStoryType((story as any).type);
    if (type === 'short_story') {
      if (shortStoryBlocksEmpty(editIllustratedBlocks)) {
        toast({ title: t('common.error'), description: t('createStory.shortStoryNeedsContent'), variant: 'destructive' });
        return;
      }
      const sv = validateShortStoryBlocks(editIllustratedBlocks);
      if (sv.length) {
        toast({
          title: t('validation.charLimitsTitle'),
          description: describeViolations(t, sv),
          variant: 'destructive',
        });
        return;
      }
    }
    setSavingContent(true);
    try {

      if (!user) throw new Error('Not authenticated');

      if (type === 'short_story') {
        await saveBlocks(story.id, null, editIllustratedBlocks, user.id);
        await updateStory(story.id, { content: null });
      }

      if (type === 'comic') {
        const pages: { image_url: string; page_order: number }[] = [];
        for (let i = 0; i < editComicPages.length; i++) {
          const page = editComicPages[i];
          let image_url = page.image_url;
          if (page.file) {
            const ext = page.file.name.split('.').pop();
            const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
            image_url = await uploadFile('comics', page.file, path);
          }
          if (image_url) pages.push({ image_url, page_order: i + 1 });
        }
        await replaceComicPages(story.id, pages);
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

  if (!id) {
    return (
      <div className={embedExploration ? 'min-h-full bg-background' : 'min-h-screen bg-background'}>
        {!embedExploration && <Header />}
        <div className="container py-20 text-center text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  if (!story) {
    return (
      <div className={embedExploration ? 'min-h-full bg-background' : 'min-h-screen bg-background'}>
        {!embedExploration && <Header />}
        {!embedExploration && (
          <div className="container max-w-2xl py-4">
            <PreviousScreenBackButton className="-mt-1" />
          </div>
        )}
        <div className="container py-20 text-center text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  const isAuthor = user?.id === story.author_id;
  const storyType = normalizeStoryType((story as any).type);

  const editMetaViolations = validateStoryMeta(editTitle.trim(), editDescription.trim());
  const editMetaOverLimit = editMetaViolations.length > 0;

  const chapterFormViolations = validateChapterTitle(chapterTitle.trim());
  const chapterFormOverLimit = chapterFormViolations.length > 0;

  const editShortViolations =
    editingContent && storyType === 'short_story' ? validateShortStoryBlocks(editIllustratedBlocks) : [];
  const editShortOverLimit = editShortViolations.length > 0;

  return (
    <div className={embedExploration ? 'min-h-full bg-background' : 'min-h-screen bg-background'}>
      {!embedExploration && <Header />}
      <main className="container py-8 max-w-2xl animate-fade-in">
        {!embedExploration && <PreviousScreenBackButton className="-mt-2 mb-4" />}
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
                <CharacterMeter length={editTitle.length} max={CONTENT_LIMITS.storyTitle} className="mt-1 text-right" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">{t('story.description')}</label>
                <Textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={4} />
                <CharacterMeter length={editDescription.length} max={CONTENT_LIMITS.storyDescription} className="mt-1 text-right" />
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
                <Button onClick={saveEdits} disabled={saving || !editTitle.trim() || editMetaOverLimit} size="sm" className="gradient-warm text-primary-foreground">
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
                <Button variant={liked ? 'default' : 'outline'} size="sm" onClick={toggleLikeHandler} className={liked ? 'gradient-warm text-primary-foreground' : ''}>
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
                <IllustratedBlockEditor blocks={editIllustratedBlocks} onChange={setEditIllustratedBlocks} />
                <CharacterMeter
                  length={editIllustratedBlocks.filter((b) => b.block_type === 'text').reduce((n, b) => n + b.content.length, 0)}
                  max={CONTENT_LIMITS.storyShortBody}
                  className="text-right"
                />
                <div className="flex gap-2">
                  <Button onClick={saveContent} disabled={savingContent || editShortOverLimit} size="sm" className="gradient-warm text-primary-foreground">
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
                {shortStoryBlocks.length > 0 ? (
                  <StoryBlocksView blocks={shortStoryBlocks} />
                ) : (story as any).content ? (
                  <div className="prose prose-sm max-w-none font-serif leading-relaxed text-foreground/90 whitespace-pre-wrap">
                    {(story as any).content}
                  </div>
                ) : (
                  <p className="text-muted-foreground italic">{t('common.noContent')}</p>
                )}
              </>
            )}
          </section>
        )}

        {storyType === 'chapters' && (
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
                <CharacterMeter length={chapterTitle.length} max={CONTENT_LIMITS.chapterTitle} className="mt-1 text-right" />
                <IllustratedBlockEditor blocks={chapterBlocks} onChange={setChapterBlocks} />
                <Button onClick={addChapter} disabled={addingChapter || chapterFormOverLimit || !chapterTitle.trim()} size="sm" className="gradient-warm text-primary-foreground">
                  {addingChapter ? t('common.saving') : t('story.saveChapter')}
                </Button>
              </div>
            )}
            {chapters.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t('story.noChapters')}</p>
            ) : (
              <div className="space-y-2">
                {chapters.map(ch =>
                  explorationOpenChapter ? (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => explorationOpenChapter(ch.chapter_number)}
                      className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-accent"
                    >
                      <BookOpen className="h-4 w-4 shrink-0 text-primary" />
                      <span className="text-sm font-medium">{ch.title}</span>
                    </button>
                  ) : (
                    <Link
                      key={ch.id}
                      href={`/story/${id}/chapter/${ch.chapter_number}`}
                      onClick={() => markChapterOpenedFromStory(id!)}
                      className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent"
                    >
                      <BookOpen className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">{ch.title}</span>
                    </Link>
                  ),
                )}
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
