import { useState, useEffect, useLayoutEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, ChevronRight, Pencil, Save, X } from 'lucide-react';
import CharacterMeter from '@/components/CharacterMeter';
import { useToast } from '@/hooks/use-toast';
import { CONTENT_LIMITS, describeViolations, validateChapterTitle } from '@/lib/contentLimits';
import { readExploration, stackItemMatchesStory } from '@/lib/feedExplorationStorage';
import {
  clearChapterReturnStoryId,
  peekChapterReturnStoryId,
} from '@/lib/storyChapterNav';
import type { Tables } from '@/integrations/supabase/types';

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
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [chapter, setChapter] = useState<Tables<'chapters'> | null>(null);
  const [totalChapters, setTotalChapters] = useState(0);
  const [authorId, setAuthorId] = useState<string | null>(null);
  const [resumeExploration, setResumeExploration] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
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
    supabase
      .from('chapters')
      .select('*')
      .eq('story_id', id)
      .eq('chapter_number', Number(chapterNum))
      .single()
      .then(({ data }) => {
        if (data) {
          setChapter(data);
          setEditTitle(data.title);
          setEditContent(data.content);
        }
      });
    supabase
      .from('chapters')
      .select('id', { count: 'exact' })
      .eq('story_id', id)
      .then(({ count }) => setTotalChapters(count || 0));
    supabase
      .from('stories')
      .select('author_id')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) setAuthorId(data.author_id);
      });
  }, [id, chapterNum]);

  const num = Number(chapterNum);
  const isAuthor = !!user && !!authorId && user.id === authorId;
  const shellClass = embedExploration ? 'min-h-full bg-background' : 'min-h-screen bg-background';

  /** Pop the chapter entry when opened from this story (avoids duplicate story URLs in history). */
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
    setEditContent(chapter.content);
    setEditing(true);
  };

  const chapterEditViolations = validateChapterTitle(editTitle.trim());
  const chapterEditOverLimit = chapterEditViolations.length > 0;

  const saveChanges = async () => {
    if (!chapter) return;
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
    const { error } = await supabase
      .from('chapters')
      .update({
        title: tT,
        content: editContent,
      })
      .eq('id', chapter.id);
    setSaving(false);
    if (error) {
      toast({ title: t('chapter.saveError'), description: error.message, variant: 'destructive' });
    } else {
      setChapter({ ...chapter, title: tT, content: editContent });
      setEditing(false);
      toast({ title: t('chapter.updated') });
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
              Cap. {num}: {chapter.title}
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
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={18}
              className="font-serif leading-relaxed"
            />
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
        ) : (
          <div className="prose prose-sm mt-6 max-w-none whitespace-pre-wrap font-serif leading-relaxed text-foreground/90">
            {chapter.content}
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
