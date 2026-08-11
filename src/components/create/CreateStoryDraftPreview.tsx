"use client";

import { BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DeepExplorePreviewFrame from '@/components/feed/DeepExplorePreviewFrame';
import StoryFeedPreviewView, {
  type StoryFeedPreviewData,
} from '@/components/feed/StoryFeedPreviewView';
import StoryBlocksView from '@/components/StoryBlocksView';
import ComicReader from '@/components/ComicReader';
import { useLanguage } from '@/hooks/useLanguage';
import { normalizeStoryType } from '@/lib/storyBlocks';
import type { TranslationKey } from '@/i18n/translations';

function StoryPageDraftPreview({ data }: { data: StoryFeedPreviewData }) {
  const { t } = useLanguage();
  const { story, chapters, comicPages, shortStoryBlocks, chapterBlocksMap } = data;
  const storyType = normalizeStoryType(story.type);

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {story.cover_image_url ? (
          <div className="mb-6 overflow-hidden rounded-xl border border-border">
            <img
              src={story.cover_image_url}
              alt=""
              className="aspect-[16/10] w-full object-cover"
            />
          </div>
        ) : null}

        <header className="mb-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{t((`typeLabel.${storyType}`) as TranslationKey)}</Badge>
            {story.universe ? <Badge variant="secondary">{story.universe.title}</Badge> : null}
            {story.arc ? <Badge variant="secondary">{story.arc.name}</Badge> : null}
          </div>
          <h1 className="text-3xl font-bold font-serif">{story.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('common.by')}{' '}
            {story.profiles?.username ?? t('common.anonymous')}
          </p>
          {story.description ? (
            <p className="mt-3 text-base text-foreground/80">{story.description}</p>
          ) : null}
          {story.tags && story.tags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {story.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
        </header>

        {storyType === 'short_story' && (
          shortStoryBlocks.length > 0 ? (
            <StoryBlocksView blocks={shortStoryBlocks} />
          ) : (
            <p className="text-muted-foreground italic">{t('common.noContent')}</p>
          )
        )}

        {storyType === 'chapters' && (
          chapters.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('story.noChapters')}</p>
          ) : (
            <div className="space-y-2">
              {chapters.map((ch) => (
                <div
                  key={ch.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <BookOpen className="h-4 w-4 shrink-0 text-primary" />
                  <span className="text-sm font-medium">{ch.title}</span>
                </div>
              ))}
              <div className="mt-8 space-y-10">
                {chapters.map((chapter) => {
                  const blocks = chapterBlocksMap[chapter.id] || [];
                  return (
                    <section key={chapter.id}>
                      <h2 className="mb-3 font-serif text-2xl font-semibold">{chapter.title}</h2>
                      {blocks.length > 0 ? (
                        <StoryBlocksView blocks={blocks} />
                      ) : (
                        <p className="text-sm text-muted-foreground">{t('common.noContent')}</p>
                      )}
                    </section>
                  );
                })}
              </div>
            </div>
          )
        )}

        {storyType === 'comic' && (
          comicPages.length > 0 ? (
            <ComicReader
              pages={comicPages}
              readingMode={story.reading_mode}
              pageClassName="rounded-xl"
            />
          ) : (
            <p className="text-muted-foreground italic">{t('common.noContent')}</p>
          )
        )}
      </div>
    </div>
  );
}

interface CreateStoryDraftPreviewProps {
  data: StoryFeedPreviewData;
  className?: string;
}

export default function CreateStoryDraftPreview({ data, className }: CreateStoryDraftPreviewProps) {
  const { t } = useLanguage();

  return (
    <div className={className}>
      <Tabs defaultValue="page" className="flex h-full min-h-0 flex-col">
        <TabsList className="mb-3 w-full shrink-0 sm:w-auto">
          <TabsTrigger value="page" className="flex-1 sm:flex-none">
            {t('createStory.previewPage')}
          </TabsTrigger>
          <TabsTrigger value="feed" className="flex-1 sm:flex-none">
            {t('createStory.previewFeedModal')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="page" className="mt-0 min-h-0 flex-1 overflow-hidden">
          <div className="h-[min(70dvh,640px)] overflow-y-auto rounded-xl border border-border bg-card">
            <StoryPageDraftPreview data={data} />
          </div>
        </TabsContent>

        <TabsContent value="feed" className="mt-0 min-h-0 flex-1 overflow-hidden">
          <div className="h-[min(70dvh,640px)]">
            <DeepExplorePreviewFrame
              onBack={() => undefined}
              onBackToFeed={() => undefined}
              openFullLabel={t('story.openFullPage')}
              onOpenFull={() => undefined}
              showOpenFull={false}
              showBackToFeedButton={false}
            >
              <StoryFeedPreviewView
                data={data}
                mode="peek"
                fullPageMode="none"
                titleAs="h2"
                showLibraryActions={false}
              />
            </DeepExplorePreviewFrame>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
