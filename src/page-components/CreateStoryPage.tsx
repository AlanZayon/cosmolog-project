import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from "next/navigation";
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Header from '@/components/Header';
import { useToast } from '@/hooks/use-toast';
import { ImagePlus, X, BookOpen, FileText, Image, Layers, Plus, ChevronUp, ChevronDown } from 'lucide-react';
import CharacterMeter from '@/components/CharacterMeter';
import TagInput from '@/components/TagInput';
import ComicPageUploader from '@/components/ComicPageUploader';
import IllustratedBlockEditor, { type IllustratedBlockItem } from '@/components/IllustratedBlockEditor';
import type { TranslationKey } from '@/i18n/translations';
import { CONTENT_LIMITS, describeViolations, validateStoryMeta, validateStoryShortBody, validateChapterTitle } from '@/lib/contentLimits';
import { HOME_FEED_PATH } from '@/lib/homeFeedNav';

type StoryType = 'short_story' | 'chapters' | 'comic' | 'illustrated';
type Universe = Tables<'universes'>;
type Arc = Tables<'arcs'>;
type DraftChapter = { title: string; content: string };

const STORY_TYPES: { value: StoryType; labelKey: TranslationKey; descKey: TranslationKey; icon: React.ReactNode }[] = [
  { value: 'short_story', labelKey: 'typeLabel.short_story', descKey: 'typeDesc.short_story', icon: <FileText className="h-5 w-5" /> },
  { value: 'chapters', labelKey: 'typeLabel.chapters', descKey: 'typeDesc.chapters', icon: <BookOpen className="h-5 w-5" /> },
  { value: 'comic', labelKey: 'typeLabel.comic', descKey: 'typeDesc.comic', icon: <Image className="h-5 w-5" /> },
  { value: 'illustrated', labelKey: 'typeLabel.illustrated', descKey: 'typeDesc.illustrated', icon: <Layers className="h-5 w-5" /> },
];

export default function CreateStoryPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const params = useParams<{ id?: string }>();
  const universeId = params.id;
  const router = useRouter();
  const { toast } = useToast();
  const [storyType, setStoryType] = useState<StoryType | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRelations, setLoadingRelations] = useState(true);
  const [universes, setUniverses] = useState<Universe[]>([]);
  const [arcs, setArcs] = useState<Arc[]>([]);
  const [selectedUniverseId, setSelectedUniverseId] = useState(universeId || '');
  const [selectedArcId, setSelectedArcId] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [content, setContent] = useState('');
  const [comicPages, setComicPages] = useState<{ file?: File; preview: string }[]>([]);
  const [illustratedBlocks, setIllustratedBlocks] = useState<IllustratedBlockItem[]>([]);
  const [draftChapters, setDraftChapters] = useState<DraftChapter[]>([]);

  useEffect(() => {
    if (!user) router.push("/login");
  }, [user, router]);

  useEffect(() => {
    if (universeId) setSelectedUniverseId(universeId);
  }, [universeId]);

  useEffect(() => {
    if (!user) return;
    fetchUniverses();
  }, [user]);

  useEffect(() => {
    if (!selectedUniverseId) {
      setArcs([]);
      setSelectedArcId('');
      return;
    }
    fetchArcs(selectedUniverseId);
  }, [selectedUniverseId]);

  const fetchUniverses = async () => {
    setLoadingRelations(true);
    const { data, error } = await supabase
      .from('universes')
      .select('*')
      .eq('owner_id', user!.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
      setLoadingRelations(false);
      return;
    }

    const universeList = data || [];
    setUniverses(universeList);

    if (universeId) {
      setSelectedUniverseId(universeId);
    }

    setLoadingRelations(false);
  };

  const fetchArcs = async (currentUniverseId: string) => {
    const { data, error } = await supabase
      .from('arcs')
      .select('*')
      .eq('universe_id', currentUniverseId)
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
      return;
    }

    const arcList = data || [];
    setArcs(arcList);
    setSelectedArcId((currentArcId) => (
      arcList.some((arc) => arc.id === currentArcId) ? currentArcId : ''
    ));
  };

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: t('story.imageTooLarge'), description: t('story.max5mb'), variant: 'destructive' });
      return;
    }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const removeCover = () => {
    setCoverFile(null);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadFile = async (bucket: string, file: File): Promise<string> => {
    const ext = file.name.split('.').pop();
    const path = `${user!.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  const metaViolationsCreate = validateStoryMeta(title.trim(), description.trim());
  const shortBodyViolationsCreate = storyType === 'short_story' ? validateStoryShortBody(content) : [];
  const chapterTitleViolationsCreate =
    storyType === 'chapters'
      ? draftChapters.flatMap((ch) => {
          const tCh = ch.title.trim();
          const cCh = ch.content.trim();
          if (!tCh && !cCh) return [];
          return validateChapterTitle(tCh);
        })
      : [];
  const createStoryViolations = [...metaViolationsCreate, ...shortBodyViolationsCreate, ...chapterTitleViolationsCreate];
  const chapterMissingTitle =
    storyType === 'chapters' && draftChapters.some((ch) => ch.content.trim() !== '' && ch.title.trim() === '');
  const createStoryOverLimit = createStoryViolations.length > 0;
  const createStoryBlocked = createStoryOverLimit || chapterMissingTitle;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !storyType) return;
    if (chapterMissingTitle) {
      toast({ title: t('common.error'), description: t('createStory.chapterNeedsTitle'), variant: 'destructive' });
      return;
    }
    if (createStoryOverLimit) {
      toast({
        title: t('validation.charLimitsTitle'),
        description: describeViolations(t, createStoryViolations),
        variant: 'destructive',
      });
      return;
    }
    setLoading(true);
    try {
      const cover_image_url = coverFile ? await uploadFile('covers', coverFile) : null;
      const titleT = title.trim();
      const descT = description.trim();

      const { data, error } = await supabase.from('stories').insert({
        title: titleT,
        description: descT || null,
        author_id: user.id,
        tags,
        type: storyType,
        content: storyType === 'short_story' ? content : null,
        universe_id: selectedUniverseId || null,
        arc_id: selectedArcId || null,
        ...(cover_image_url && { cover_image_url }),
      } as any).select().single();

      if (error) throw error;
      const storyId = (data as any).id;

      if (storyType === 'comic' && comicPages.length > 0) {
        for (let i = 0; i < comicPages.length; i++) {
          const page = comicPages[i];
          if (page.file) {
            const imageUrl = await uploadFile('comics', page.file);
            await supabase.from('comic_pages').insert({
              story_id: storyId,
              image_url: imageUrl,
              page_order: i + 1,
            } as any);
          }
        }
      }

      if (storyType === 'illustrated' && illustratedBlocks.length > 0) {
        for (let i = 0; i < illustratedBlocks.length; i++) {
          const block = illustratedBlocks[i];
          let blockContent = block.content;
          if (block.block_type === 'image' && block.file) {
            blockContent = await uploadFile('comics', block.file);
          }
          await supabase.from('illustrated_blocks').insert({
            story_id: storyId,
            block_type: block.block_type,
            content: blockContent,
            block_order: i + 1,
          } as any);
        }
      }

      if (storyType === 'chapters' && draftChapters.length > 0) {
        let chapterNum = 1;
        for (const ch of draftChapters) {
          const chTitle = ch.title.trim();
          if (!chTitle) continue;
          const { error: chError } = await supabase.from('chapters').insert({
            story_id: storyId,
            title: chTitle,
            content: ch.content.trim(),
            chapter_number: chapterNum++,
          } as any);
          if (chError) throw chError;
        }
      }

      toast({ title: t('createStory.success') });
      router.push(`/story/${storyId}`);
    } catch (err: any) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const backHref = universeId ? `/universe/${universeId}` : HOME_FEED_PATH;

  if (!storyType) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8 max-w-lg animate-fade-in">
          <div className="mb-6">
            <Button variant="ghost" size="sm" className="-ml-2 h-9 px-2" asChild>
              <Link href={backHref}>{t('common.back')}</Link>
            </Button>
          </div>
          <h1 className="text-2xl font-bold font-serif mb-6">{t('createStory.title')}</h1>
          {loadingRelations ? (
            <p className="text-muted-foreground mb-4">{t('common.loading')}</p>
          ) : (
            <div className="rounded-xl border border-border bg-card p-4 mb-6">
              <p className="text-sm text-muted-foreground mb-3">{t('createStory.universeOptional')}</p>
              <label className="text-sm font-medium text-foreground mb-2 block">{t('story.universe')}</label>
              <select
                value={selectedUniverseId}
                onChange={(e) => setSelectedUniverseId(e.target.value)}
                disabled={!!universeId}
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="">{t('common.none')}</option>
                {universes.map((universe) => (
                  <option key={universe.id} value={universe.id}>{universe.title}</option>
                ))}
              </select>
            </div>
          )}
          <p className="text-muted-foreground mb-4">{t('createStory.chooseType')}</p>
          <div className="grid gap-3">
            {STORY_TYPES.map(st => (
              <button
                key={st.value}
                onClick={() => setStoryType(st.value)}
                disabled={loadingRelations}
                className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-accent transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="p-2 rounded-lg bg-primary/10 text-primary">{st.icon}</div>
                <div>
                  <p className="font-semibold text-sm">{t(st.labelKey)}</p>
                  <p className="text-xs text-muted-foreground">{t(st.descKey)}</p>
                </div>
              </button>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 max-w-lg animate-fade-in">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="sm" className="-ml-2 h-9 shrink-0 px-2" onClick={() => setStoryType(null)}>
              {t('common.back')}
            </Button>
            <h1 className="text-2xl font-bold font-serif">
              {t(STORY_TYPES.find(st => st.value === storyType)!.labelKey)}
            </h1>
          </div>
          <Button variant="ghost" size="sm" className="h-9 shrink-0 text-muted-foreground hover:text-foreground" asChild>
            <Link href={backHref}>{t('header.home')}</Link>
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">{t('story.universe')}</label>
            <select
              value={selectedUniverseId}
              onChange={(e) => setSelectedUniverseId(e.target.value)}
              disabled={!!universeId}
              className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="">{t('common.none')}</option>
              {universes.map((universe) => (
                <option key={universe.id} value={universe.id}>{universe.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">{t('story.arc')}</label>
            <select
              value={selectedArcId}
              onChange={(e) => setSelectedArcId(e.target.value)}
              className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
              disabled={!selectedUniverseId}
            >
              <option value="">{t('common.none')}</option>
              {arcs.map((arc) => (
                <option key={arc.id} value={arc.id}>{arc.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">{t('story.cover')}</label>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleCoverSelect} className="hidden" />
            {coverPreview ? (
              <div className="relative w-full aspect-[3/4] max-w-[200px] rounded-lg overflow-hidden border border-border">
                <img src={coverPreview} alt="Preview" className="w-full h-full object-cover" />
                <button type="button" onClick={removeCover} className="absolute top-2 right-2 p-1 rounded-full bg-background/80 hover:bg-background text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center w-full aspect-[3/4] max-w-[200px] rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors bg-muted/30">
                <ImagePlus className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-xs text-muted-foreground">{t('story.addCover')}</span>
              </button>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">{t('story.title')}</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('createStory.titlePlaceholder')} required />
            <CharacterMeter length={title.length} max={CONTENT_LIMITS.storyTitle} className="mt-1 text-right" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">{t('story.description')}</label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={t('createStory.descPlaceholder')} rows={3} />
            <CharacterMeter length={description.length} max={CONTENT_LIMITS.storyDescription} className="mt-1 text-right" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">{t('story.tags')}</label>
            <TagInput tags={tags} onChange={setTags} />
          </div>

          {storyType === 'short_story' && (
            <div>
              <label className="text-sm font-medium text-foreground">{t('createStory.contentLabel')}</label>
              <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder={t('createStory.contentPlaceholder')} rows={12} required />
              <CharacterMeter length={content.length} max={CONTENT_LIMITS.storyShortBody} className="mt-1 text-right" />
            </div>
          )}

          {storyType === 'chapters' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t('createStory.chaptersHint')}</p>
              <label className="text-sm font-medium text-foreground block">{t('story.chapters')}</label>
              <div className="space-y-3">
                {draftChapters.map((ch, i) => (
                  <div key={i} className="p-3 rounded-lg border border-border bg-card space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground font-medium">{t('story.chapters')} {i + 1}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            if (i === 0) return;
                            const next = [...draftChapters];
                            [next[i - 1], next[i]] = [next[i], next[i - 1]];
                            setDraftChapters(next);
                          }}
                          disabled={i === 0}
                          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30"
                          aria-label={t('common.previous')}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (i >= draftChapters.length - 1) return;
                            const next = [...draftChapters];
                            [next[i], next[i + 1]] = [next[i + 1], next[i]];
                            setDraftChapters(next);
                          }}
                          disabled={i === draftChapters.length - 1}
                          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30"
                          aria-label={t('common.next')}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDraftChapters(draftChapters.filter((_, j) => j !== i))}
                          className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          aria-label={t('common.delete')}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <Input
                        value={ch.title}
                        onChange={(e) => {
                          const next = [...draftChapters];
                          next[i] = { ...next[i], title: e.target.value };
                          setDraftChapters(next);
                        }}
                        placeholder={t('story.chapterTitlePlaceholder')}
                      />
                      <CharacterMeter length={ch.title.length} max={CONTENT_LIMITS.chapterTitle} className="mt-1 text-right" />
                    </div>
                    <Textarea
                      value={ch.content}
                      onChange={(e) => {
                        const next = [...draftChapters];
                        next[i] = { ...next[i], content: e.target.value };
                        setDraftChapters(next);
                      }}
                      placeholder={t('story.chapterContentPlaceholder')}
                      rows={6}
                    />
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setDraftChapters([...draftChapters, { title: '', content: '' }])}
              >
                <Plus className="h-4 w-4 mr-1" />
                {t('createStory.addChapter')}
              </Button>
            </div>
          )}

          {storyType === 'comic' && (
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">{t('createStory.pagesLabel')}</label>
              <ComicPageUploader pages={comicPages} onChange={setComicPages} />
            </div>
          )}

          {storyType === 'illustrated' && (
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">{t('createStory.blocksLabel')}</label>
              <IllustratedBlockEditor blocks={illustratedBlocks} onChange={setIllustratedBlocks} />
            </div>
          )}

          <Button type="submit" className="w-full gradient-warm text-primary-foreground" disabled={loading || createStoryBlocked}>
            {loading ? t('common.creating') : t('createStory.submit')}
          </Button>
        </form>
      </main>
    </div>
  );
}
