import { useState, useEffect, useLayoutEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  getChapterByNumber,
  getChapterCount,
  getStoryById,
  updateChapter,
} from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, Pencil, Save, X } from 'lucide-react';
import CharacterMeter from '@/components/CharacterMeter';
import IllustratedBlockEditor, { type IllustratedBlockItem } from '@/components/IllustratedBlockEditor';
import StoryBlocksView from '@/components/StoryBlocksView';
import { useToast } from '@/hooks/use-toast';
import { CONTENT_LIMITS, describeViolations, validateChapterTitle } from '@/lib/contentLimits';
import {
  blocksFromLegacyPlainText,
  blocksToEditorItems,
  loadBlocks,
  saveBlocks,
} from '@/lib/storyBlocks';
import { readExploration, stackItemMatchesStory } from '@/lib/feedExplorationStorage';
import {
  clearChapterReturnStoryId,
  peekChapterReturnStoryId,
} from '@/lib/storyChapterNav';
import type { Tables } from '@/integrations/supabase/types';
import type { StoryBlockRow } from '@/lib/storyBlocks';

export type ChapterPageProps = {
  embedExploration?: boolean;
  storyIdOverride?: string;
  chapterNumOverride?: number;
  explorationNavigateChapter?: (chapterNum: number) => void;
};

export default function ChapterPage({
  embedExploration = false,
  storyIdOverride,
  chapterNumOverride,
  explorationNavigateChapter,
}: ChapterPageProps = {}) {
  const params = useParams<{ id: string; chapterNum: string }>();
  const id = (storyIdOverride ?? params?.id) as string | undefined;
  const chapterNum =
    chapterNumOverride != null ? String(chapterNumOverride) : (params?.chapterNum as string | undefined);
  const router = useRouter();
  const { user, session } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [chapter, setChapter] = useState<Tables<'chapters'> | null>(null);
  const [chapterBlocks, setChapterBlocks] = useState<StoryBlockRow[]>([]);
  const [totalChapters, setTotalChapters] = useState(0);
  const [authorId, setAuthorId] = useState<string | null>(null);
  const [resumeExploration, setResumeExploration] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBlocks, setEditBlocks] = useState<IllustratedBlockItem[]>([]);
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => {
    if (embedExploration || !id) {
      setResumeExploration(false);
      return;
    }
    const persisted = readExploration();
    setResumeExploration(Boolean(persisted?.stack.some((item) => stackItemMatchesStory(item, id))));
  }, [embedExploration, id]);

  useEffect(() => {
    if (!id || !chapterNum) return;
    void (async () => {
      const num = Number(chapterNum);
      const data = await getChapterByNumber(id, num);
      if (data) {
        setChapter(data as Tables<'chapters'>);
        setEditTitle(data.title);
        const blocks = await loadBlocks(id, data.id);
        setChapterBlocks(blocks);
      }
      const { count } = await getChapterCount(id);
      setTotalChapters(count);
      const story = await getStoryById(id);
      setAuthorId(story.author_id);
    })();
  }, [id, chapterNum]);

  const num = Number(chapterNum);
  const isAuthor = !!user && !!authorId && user.id === authorId;
  const shellClass = embedExploration ? 'min-h-full bg-background' : 'min-h-screen bg-background';

  const goBackToStory = () => {
    const openedFromThisStory = id != null && peekChapterReturnStoryId() === id;
    if (openedFromThisStory && typeof window !== 'undefined' && window.history.length > 1) {
      clearChapterReturnStoryId();
      router.back();
      return;
    }
    clearChapterReturnStoryId();
    router.replace(`/story/${id}`);
  };

  const startEditing = () => {
    if (!chapter) return;
    setEditTitle(chapter.title);
    const items =
      chapterBlocks.length > 0
        ? blocksToEditorItems(chapterBlocks)
        : blocksFromLegacyPlainText(chapter.content);
    setEditBlocks(items);
    setEditing(true);
  };

  const chapterEditViolations = validateChapterTitle(editTitle.trim());
  const chapterEditOverLimit = chapterEditViolations.length > 0;

  const saveChanges = async () => {
    if (!chapter || !user || !id) return;
    const tT = editTitle.trim();
    if (!tT) return;
    const v = validateChapterTitle(tT);
    if (v.length) {
      toast({
        title: t('validation.charLimitsTitle'),
        description: describeViolations(t, v),
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      if (!session?.access_token) throw new Error('Not authenticated');
      await updateChapter(session.access_token, id, chapter.id, tT);
      await saveBlocks(id, chapter.id, editBlocks, session.access_token, user.id);
      const blocks = await loadBlocks(id, chapter.id);
      setChapter({ ...chapter, title: tT, content: '' });
      setChapterBlocks(blocks);
      setEditing(false);
      toast({ title: t('chapter.updated') });
    } catch (err: any) {
      toast({ title: t('chapter.saveError'), description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!chapter) {
    return (
      <div className={shellClass}>
        {!embedExploration && <Header />}
        <div className="container py-20 text-center text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  const backControl = embedExploration ? null : resumeExploration ? (
    <Button
      type="button"
      variant="link"
      className="mb-4 h-auto p-0 text-sm text-primary"
      onClick={() => router.push('/')}
    >
      {t('feed.returnToExploration')}
    </Button>
  ) : (
    <Button
      type="button"
      variant="link"
      className="mb-4 h-auto p-0 text-sm text-primary"
      onClick={goBackToStory}
    >
      {t('chapter.backToStory')}
    </Button>
  );

  const prevControl =
    num > 1 ? (
      explorationNavigateChapter ? (
        <Button type="button" variant="outline" onClick={() => explorationNavigateChapter(num - 1)}>
          <ChevronLeft className="mr-1 h-4 w-4" /> {t('common.previous')}
        </Button>
      ) : (
        <Button variant="outline" asChild>
          <Link href={`/story/${id}/chapter/${num - 1}`}>
            <ChevronLeft className="mr-1 h-4 w-4" /> {t('common.previous')}
          </Link>
        </Button>
      )
    ) : (
      <div />
    );

  const nextControl =
    num < totalChapters ? (
      explorationNavigateChapter ? (
        <Button type="button" variant="outline" onClick={() => explorationNavigateChapter(num + 1)}>
          {t('common.next')} <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      ) : (
        <Button variant="outline" asChild>
          <Link href={`/story/${id}/chapter/${num + 1}`}>
            {t('common.next')} <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      )
    ) : (
      <div />
    );

  return (
    <div className={shellClass}>
      {!embedExploration && <Header />}
      <main className={`container max-w-2xl animate-fade-in ${embedExploration ? 'px-4 py-6 sm:px-8' : 'py-8'}`}>
        {backControl}

        <div className="mb-1 flex items-start justify-between gap-2">
          {editing ? (
            <div className="min-w-0 flex-1">
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="font-serif text-2xl font-bold"
              />
              <CharacterMeter length={editTitle.length} max={CONTENT_LIMITS.chapterTitle} className="mt-1 text-right" />
            </div>
          ) : (
            <h1 className="font-serif text-2xl font-bold">
              {chapter.title}
            </h1>
          )}
          {isAuthor && !editing && (
            <Button variant="ghost" size="icon" onClick={startEditing}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>

        {editing ? (
          <div className="mt-4 space-y-4">
            <IllustratedBlockEditor blocks={editBlocks} onChange={setEditBlocks} />
            <div className="flex gap-2">
              <Button onClick={saveChanges} disabled={saving || chapterEditOverLimit || !editTitle.trim()}>
                <Save className="mr-1 h-4 w-4" />
                {saving ? t('common.saving') : t('common.save')}
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)}>
                <X className="mr-1 h-4 w-4" />
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        ) : chapterBlocks.length > 0 ? (
          <StoryBlocksView blocks={chapterBlocks} className="mt-6" />
        ) : (
          <div className="prose prose-sm mt-6 max-w-none whitespace-pre-wrap font-serif leading-relaxed text-foreground/90">
            {chapter.content || <span className="text-muted-foreground italic">{t('common.noContent')}</span>}
          </div>
        )}

        <div className="mt-10 flex justify-between">
          {prevControl}
          {nextControl}
        </div>
      </main>
    </div>
  );
}
