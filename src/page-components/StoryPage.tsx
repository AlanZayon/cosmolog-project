'use client';

import { useState, useEffect, useRef } from 'react';
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  createChapter,
  replaceComicPages,
  updateStory,
} from '@/lib/api';
import { uploadFile } from '@/lib/api/storage';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import Header from '@/components/Header';
import ProfileAuthorLink from '@/components/ProfileAuthorLink';
import PreviousScreenBackButton from '@/components/PreviousScreenBackButton';
import { MessageCircle, Plus, BookOpen, Pencil, X, ImagePlus, Save } from 'lucide-react';
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
  normalizeStoryType,
  saveBlocks,
} from '@/lib/storyBlocks';
import StoryBlocksView from '@/components/StoryBlocksView';
import StoryCommentsPanel from '@/components/comments/StoryCommentsPanel';
import type { Tables } from '@/integrations/supabase/types';
import type { TranslationKey } from '@/i18n/translations';
import FeedDisplayModeField, { type FeedDisplayMode } from '@/components/FeedDisplayModeField';
import ReadingModeField, { type ReadingMode } from '@/components/ReadingModeField';
import ComicReader from '@/components/ComicReader';
import StoryLibraryActions from '@/components/library/StoryLibraryActions';
import { StoryBodySkeleton, StoryReaderSkeleton } from '@/components/loading/skeletons';
import { clearChapterReturnStoryId, markChapterOpenedFromStory } from '@/lib/storyChapterNav';
import { queryKeys } from '@/lib/query-keys';
import {
  fetchStoryPageBody,
  fetchStoryPageMeta,
  type StoryWithProfile,
} from '@/lib/storyPageBundle';

type Arc = Tables<'arcs'>;

export type StoryPageProps = {
  /** Render without site header; used inside feed exploration full surface. */
  embedExploration?: boolean;
  storyIdOverride?: string;
  /** Open a chapter inside the feed exploration stack instead of leaving for a canonical route. */
  explorationOpenChapter?: (chapterNum: number) => void;
  /** Scroll to the comments section after the story loads (feed comment button). */
  focusComments?: boolean;
};

export default function StoryPage({
  embedExploration = false,
  storyIdOverride,
  explorationOpenChapter,
  focusComments = false,
}: StoryPageProps = {}) {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = (storyIdOverride ?? params?.id) as string | undefined;
  const highlightCommentId = searchParams.get('comment');
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [story, setStory] = useState<StoryWithProfile | null>(null);
  const [storyArc, setStoryArc] = useState<Arc | null>(null);
  const [availableArcs, setAvailableArcs] = useState<Arc[]>([]);
  const [chapters, setChapters] = useState<Tables<'chapters'>[]>([]);
  const [comicPages, setComicPages] = useState<any[]>([]);
  const [shortStoryBlocks, setShortStoryBlocks] = useState<any[]>([]);
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
  const [editFeedDisplayMode, setEditFeedDisplayMode] = useState<FeedDisplayMode>('preview');
  const [editReadingMode, setEditReadingMode] = useState<ReadingMode>('vertical');
  const [saving, setSaving] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const commentsSectionRef = useRef<HTMLElement>(null);

  const metaQuery = useQuery({
    queryKey: id ? [...queryKeys.story.detail(id), 'meta'] : ['story', 'missing', 'meta'],
    queryFn: () => fetchStoryPageMeta(id!),
    enabled: Boolean(id),
    staleTime: 60_000,
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });

  const bodyQuery = useQuery({
    queryKey: id ? [...queryKeys.story.detail(id), 'body'] : ['story', 'missing', 'body'],
    queryFn: () => fetchStoryPageBody(id!, metaQuery.data?.story.type),
    enabled: Boolean(id) && metaQuery.isSuccess,
    staleTime: 60_000,
  });

  const storyLoading = Boolean(id) && metaQuery.isPending && !metaQuery.data;
  const bodyLoading = Boolean(id) && metaQuery.isSuccess && bodyQuery.isPending && !bodyQuery.data;
  const storyNotFound =
    Boolean(id) &&
    !storyLoading &&
    (metaQuery.isError || (metaQuery.isFetched && !metaQuery.data));

  useEffect(() => {
    if (!metaQuery.data) return;
    setStory(metaQuery.data.story);
    setAvailableArcs(metaQuery.data.availableArcs);
    setStoryArc(metaQuery.data.storyArc);
  }, [metaQuery.data]);

  useEffect(() => {
    if (!bodyQuery.data) return;
    setChapters(bodyQuery.data.chapters);
    setComicPages(bodyQuery.data.comicPages);
    setShortStoryBlocks(bodyQuery.data.shortStoryBlocks);
  }, [bodyQuery.data]);

  useEffect(() => {
    if (!embedExploration && id) clearChapterReturnStoryId();
  }, [embedExploration, id]);

  useEffect(() => {
    if ((!focusComments && !highlightCommentId) || !story) return;
    const frame = requestAnimationFrame(() => {
      commentsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusComments, highlightCommentId, story?.id]);

  const fetchAll = async () => {
    if (!id) return;
    await queryClient.invalidateQueries({ queryKey: queryKeys.story.detail(id) });
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
    setEditFeedDisplayMode(
      story.feed_display_mode === 'cover' ? 'cover' : 'preview',
    );
    const rm = story.reading_mode;
    setEditReadingMode(
      rm === 'horizontal' || rm === 'both' || rm === 'vertical' ? rm : 'vertical',
    );
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
    if (editFeedDisplayMode === 'cover' && !editCoverPreview) {
      toast({
        title: t('common.error'),
        description: t('story.feedDisplayCoverRequired'),
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
        feed_display_mode: editFeedDisplayMode,
        ...(normalizeStoryType((story as any).type) === 'comic'
          ? { reading_mode: editReadingMode }
          : {}),
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

  if (!id || storyLoading || (metaQuery.isSuccess && !story)) {
    return (
      <div className={embedExploration ? 'min-h-full bg-background' : 'min-h-screen bg-background'}>
        {!embedExploration && <Header />}
        {!embedExploration && (
          <div className="container max-w-2xl py-4">
            <PreviousScreenBackButton className="-mt-1" />
          </div>
        )}
        <main className="container max-w-2xl py-8">
          <span className="sr-only">{t('common.loading')}</span>
          <StoryReaderSkeleton />
        </main>
      </div>
    );
  }

  if (storyNotFound || !story) {
    return (
      <div className={embedExploration ? 'min-h-full bg-background' : 'min-h-screen bg-background'}>
        {!embedExploration && <Header />}
        {!embedExploration && (
          <div className="container max-w-2xl py-4">
            <PreviousScreenBackButton className="-mt-1" />
          </div>
        )}
        <div className="container py-20 text-center text-muted-foreground">{t('common.noContent')}</div>
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
              <FeedDisplayModeField value={editFeedDisplayMode} onChange={setEditFeedDisplayMode} />
              {normalizeStoryType((story as any).type) === 'comic' && (
                <ReadingModeField value={editReadingMode} onChange={setEditReadingMode} />
              )}
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
              <p className="text-muted-foreground text-sm">
                {t('common.by')}{' '}
                {story.profiles?.username ? (
                  <ProfileAuthorLink
                    username={story.profiles.username}
                    className="font-normal text-muted-foreground"
                  />
                ) : (
                  t('common.anonymous')
                )}
              </p>
              {storyArc && <p className="text-sm text-muted-foreground mt-1">{t('story.arc')}: {storyArc.name}</p>}
              {story.description && <p className="mt-3 text-foreground/80">{story.description}</p>}
              {(story as any).tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {(story as any).tags.map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-4 mt-4">
                <StoryLibraryActions
                  storyId={id!}
                  likesCount={story.likes_count}
                  onLikesCountChange={(count) =>
                    setStory((s) => (s ? { ...s, likes_count: count } : s))
                  }
                />
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:text-foreground"
                    aria-label={t('story.comments')}
                    onClick={() =>
                      commentsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                  >
                    <MessageCircle className="h-4 w-4" /> {story.comments_count}
                  </button>
                </span>
              </div>
            </>
          )}
        </div>

        {/* Content by type */}
        {bodyLoading ? (
          <StoryBodySkeleton />
        ) : (
          <>
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
              <ComicReader
                pages={comicPages}
                readingMode={story.reading_mode}
              />
            )}
          </section>
        )}
          </>
        )}

        {/* Comments */}
        <section
          ref={commentsSectionRef}
          id="story-comments"
          className="scroll-mt-4 mt-10 border-t border-border/60 pt-8"
        >
          <div className="mb-5 flex items-baseline justify-between gap-3">
            <h2 className="font-serif text-xl font-semibold tracking-tight">{t('story.comments')}</h2>
            {story ? (
              <span className="text-sm tabular-nums text-muted-foreground">
                {story.comments_count}
              </span>
            ) : null}
          </div>
          {id ? (
            <StoryCommentsPanel
              storyId={id}
              variant="inline"
              autoFocusInput={focusComments}
              highlightCommentId={highlightCommentId}
              onCommentCreated={() =>
                setStory((prev) =>
                  prev ? { ...prev, comments_count: prev.comments_count + 1 } : prev,
                )
              }
            />
          ) : null}
        </section>
      </main>
    </div>
  );
}
