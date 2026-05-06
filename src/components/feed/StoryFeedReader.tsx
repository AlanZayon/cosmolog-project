import { useEffect, useState } from 'react';
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/hooks/useLanguage';
import type { Tables } from '@/integrations/supabase/types';
import type { TranslationKey } from '@/i18n/translations';

type StoryWithProfile = Tables<'stories'> & {
  profiles: { username: string } | null;
  universe?: { id: string; title: string } | null;
  arc?: { id: string; name: string } | null;
};

interface StoryFeedReaderProps {
  open: boolean;
  storyId: string;
  onOpenChange: (open: boolean) => void;
}

export default function StoryFeedReader({ open, storyId, onOpenChange }: StoryFeedReaderProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [story, setStory] = useState<StoryWithProfile | null>(null);
  const [chapters, setChapters] = useState<Tables<'chapters'>[]>([]);
  const [comicPages, setComicPages] = useState<Tables<'comic_pages'>[]>([]);
  const [illustratedBlocks, setIllustratedBlocks] = useState<Tables<'illustrated_blocks'>[]>([]);

  useEffect(() => {
    if (!open) return;
    fetchStory();
  }, [open, storyId]);

  const fetchStory = async () => {
    setLoading(true);
    const { data } = await supabase.from("stories").select("*").eq("id", storyId).single();
    const storyData = data as Tables<"stories"> | null;

    if (!storyData) {
      setStory(null);
      setLoading(false);
      return;
    }

    const [{ data: profile }, { data: universe }, { data: arc }] = await Promise.all([
      supabase.from('profiles').select('username').eq('user_id', storyData.author_id).single(),
      storyData.universe_id
        ? supabase.from('universes').select('id, title').eq('id', storyData.universe_id).single()
        : Promise.resolve({ data: null }),
      storyData.arc_id
        ? supabase.from('arcs').select('id, name').eq('id', storyData.arc_id).single()
        : Promise.resolve({ data: null }),
    ]);

    setStory({ ...storyData, profiles: profile, universe, arc } as StoryWithProfile);

    if (storyData.type === 'chapters' || !storyData.type) {
      const { data } = await supabase.from('chapters').select('*').eq('story_id', storyId).order('chapter_number');
      setChapters(data || []);
    } else {
      setChapters([]);
    }

    if (storyData.type === 'comic') {
      const { data } = await supabase.from('comic_pages').select('*').eq('story_id', storyId).order('page_order');
      setComicPages(data || []);
    } else {
      setComicPages([]);
    }

    if (storyData.type === 'illustrated') {
      const { data } = await supabase.from('illustrated_blocks').select('*').eq('story_id', storyId).order('block_order');
      setIllustratedBlocks(data || []);
    } else {
      setIllustratedBlocks([]);
    }

    setLoading(false);
  };

  const storyType = story?.type || 'chapters';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!left-0 !top-0 !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 overflow-y-auto rounded-none border-0 p-0">
        {loading || !story ? (
          <>
            <DialogTitle className="sr-only">{t("common.loading")}</DialogTitle>
            <div className="min-h-screen bg-background p-8 text-center text-muted-foreground">{t("common.loading")}</div>
          </>
        ) : (
          <div className="min-h-screen bg-background">
            <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
              <DialogHeader className="mb-8 pr-10">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <Badge variant="outline">{t((`typeLabel.${storyType}`) as TranslationKey)}</Badge>
                  {story.universe && <Badge variant="secondary">{story.universe.title}</Badge>}
                  {story.arc && <Badge variant="secondary">{story.arc.name}</Badge>}
                </div>
                <DialogTitle className="text-3xl font-bold font-serif">{story.title}</DialogTitle>
                <p className="text-sm text-muted-foreground mt-2">{t('common.by')} {story.profiles?.username || t('common.anonymous')}</p>
                {story.description && <p className="text-base text-foreground/80 mt-3">{story.description}</p>}
                <Link href={`/story/${story.id}`} className="text-sm text-primary hover:underline mt-3 inline-block">
                  {t('story.openFullPage')}
                </Link>
              </DialogHeader>

              {storyType === 'short_story' && (
                <div className="prose prose-lg max-w-none font-serif leading-relaxed whitespace-pre-wrap">
                  {story.content || t('common.noContent')}
                </div>
              )}

              {(storyType === 'chapters' || !storyType) && (
                <div className="space-y-8">
                  {chapters.map((chapter) => (
                    <section key={chapter.id}>
                      <h2 className="text-2xl font-semibold font-serif mb-3">Cap. {chapter.chapter_number}: {chapter.title}</h2>
                      <div className="prose prose-lg max-w-none font-serif leading-relaxed whitespace-pre-wrap">
                        {chapter.content}
                      </div>
                    </section>
                  ))}
                </div>
              )}

              {storyType === 'comic' && (
                <div className="space-y-6">
                  {comicPages.map((page) => (
                    <div key={page.id} className="rounded-xl overflow-hidden border border-border">
                      <img src={page.image_url} alt={`${t('story.page')} ${page.page_order}`} className="w-full object-contain" />
                    </div>
                  ))}
                </div>
              )}

              {storyType === 'illustrated' && (
                <div className="space-y-8">
                  {illustratedBlocks.map((block) => (
                    <div key={block.id}>
                      {block.block_type === 'image' ? (
                        <div className="rounded-xl overflow-hidden border border-border">
                          <img src={block.content} alt={t('story.illustration')} className="w-full object-contain" />
                        </div>
                      ) : (
                        <div className="prose prose-lg max-w-none font-serif leading-relaxed whitespace-pre-wrap">
                          {block.content}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
