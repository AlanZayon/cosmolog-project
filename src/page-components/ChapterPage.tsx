import { useState, useEffect } from 'react';
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, ChevronRight, Pencil, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

export default function ChapterPage() {
  const { id, chapterNum } = useParams<{ id: string; chapterNum: string }>() as {
    id: string;
    chapterNum: string;
  };
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [chapter, setChapter] = useState<Tables<'chapters'> | null>(null);
  const [totalChapters, setTotalChapters] = useState(0);
  const [authorId, setAuthorId] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id || !chapterNum) return;
    supabase.from('chapters').select('*').eq('story_id', id).eq('chapter_number', Number(chapterNum)).single()
      .then(({ data }) => {
        if (data) {
          setChapter(data);
          setEditTitle(data.title);
          setEditContent(data.content);
        }
      });
    supabase.from('chapters').select('id', { count: 'exact' }).eq('story_id', id)
      .then(({ count }) => setTotalChapters(count || 0));
    supabase.from('stories').select('author_id').eq('id', id).single()
      .then(({ data }) => { if (data) setAuthorId(data.author_id); });
  }, [id, chapterNum]);

  const num = Number(chapterNum);
  const isAuthor = !!user && !!authorId && user.id === authorId;

  const startEditing = () => {
    if (!chapter) return;
    setEditTitle(chapter.title);
    setEditContent(chapter.content);
    setEditing(true);
  };

  const saveChanges = async () => {
    if (!chapter) return;
    setSaving(true);
    const { error } = await supabase.from('chapters').update({
      title: editTitle,
      content: editContent,
    }).eq('id', chapter.id);
    setSaving(false);
    if (error) {
      toast({ title: t('chapter.saveError'), description: error.message, variant: 'destructive' });
    } else {
      setChapter({ ...chapter, title: editTitle, content: editContent });
      setEditing(false);
      toast({ title: t('chapter.updated') });
    }
  };

  if (!chapter) return <div className="min-h-screen bg-background"><Header /><div className="container py-20 text-center text-muted-foreground">{t('common.loading')}</div></div>;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 max-w-2xl animate-fade-in">
        <Link href={`/story/${id}`} className="text-sm text-primary hover:underline mb-4 inline-block">{t('chapter.backToStory')}</Link>

        <div className="flex items-start justify-between gap-2 mb-1">
          {editing ? (
            <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="text-2xl font-bold font-serif" />
          ) : (
            <h1 className="text-2xl font-bold font-serif">Cap. {num}: {chapter.title}</h1>
          )}
          {isAuthor && !editing && (
            <Button variant="ghost" size="icon" onClick={startEditing}><Pencil className="h-4 w-4" /></Button>
          )}
        </div>

        {editing ? (
          <div className="mt-4 space-y-4">
            <Textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={18} className="font-serif leading-relaxed" />
            <div className="flex gap-2">
              <Button onClick={saveChanges} disabled={saving}><Save className="h-4 w-4 mr-1" />{saving ? t('common.saving') : t('common.save')}</Button>
              <Button variant="outline" onClick={() => setEditing(false)}><X className="h-4 w-4 mr-1" />{t('common.cancel')}</Button>
            </div>
          </div>
        ) : (
          <div className="prose prose-sm max-w-none mt-6 font-serif leading-relaxed text-foreground/90 whitespace-pre-wrap">
            {chapter.content}
          </div>
        )}

        <div className="flex justify-between mt-10">
          {num > 1 ? (
            <Button variant="outline" asChild><Link href={`/story/${id}/chapter/${num - 1}`}><ChevronLeft className="h-4 w-4 mr-1" /> {t('common.previous')}</Link></Button>
          ) : <div />}
          {num < totalChapters ? (
            <Button variant="outline" asChild><Link href={`/story/${id}/chapter/${num + 1}`}>{t('common.next')} <ChevronRight className="h-4 w-4 ml-1" /></Link></Button>
          ) : <div />}
        </div>
      </main>
    </div>
  );
}
