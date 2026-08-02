import {
  getComicPages,
  getProfileByUserId,
  getStoryById,
  getStoryChapters,
  getUniverseArcs,
} from '@/lib/api';
import type { ApiStory } from '@/lib/api/types';
import { loadBlocks, normalizeStoryType } from '@/lib/storyBlocks';
import type { Tables } from '@/integrations/supabase/types';

export type StoryWithProfile = ApiStory & { profiles: { username: string } | null };
type Arc = Tables<'arcs'>;

export type StoryPageMeta = {
  story: StoryWithProfile;
  availableArcs: Arc[];
  storyArc: Arc | null;
};

export type StoryPageBody = {
  chapters: Tables<'chapters'>[];
  comicPages: Tables<'comic_pages'>[];
  shortStoryBlocks: Awaited<ReturnType<typeof loadBlocks>>;
};

export async function fetchStoryPageMeta(id: string): Promise<StoryPageMeta> {
  const storyData = await getStoryById(id);
  const authorProfile = await getProfileByUserId(storyData.author_id);
  const story: StoryWithProfile = {
    ...storyData,
    profiles: authorProfile ? { username: authorProfile.username } : null,
  };

  let availableArcs: Arc[] = [];
  let storyArc: Arc | null = null;
  if (storyData.universe_id) {
    const arcsData = await getUniverseArcs(storyData.universe_id);
    const sorted = [...arcsData].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    availableArcs = sorted as Arc[];
    storyArc = availableArcs.find((arc) => arc.id === storyData.arc_id) || null;
  }

  return { story, availableArcs, storyArc };
}

export async function fetchStoryPageBody(
  id: string,
  storyType: string | null | undefined,
): Promise<StoryPageBody> {
  const chapters =
    normalizeStoryType(storyType) === 'chapters'
      ? ((await getStoryChapters(id)) as Tables<'chapters'>[])
      : [];

  const comicPages =
    storyType === 'comic' ? ((await getComicPages(id)) as Tables<'comic_pages'>[]) : [];

  const shortStoryBlocks = storyType === 'short_story' ? await loadBlocks(id, null) : [];

  return { chapters, comicPages, shortStoryBlocks };
}
