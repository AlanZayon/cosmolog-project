import { apiFetch } from '@/lib/api/client';
import type { ApiStory } from '@/lib/api/types';

export type ApiChapter = {
  id: string;
  story_id: string;
  title: string;
  content: string;
  chapter_number: number;
  created_at: string;
  updated_at: string;
};

export type ApiComicPage = {
  id: string;
  story_id: string;
  image_url: string;
  page_order: number;
  created_at: string;
};

export type ApiBlock = {
  id: string;
  story_id: string;
  chapter_id: string | null;
  block_type: string;
  content: string;
  block_order: number;
  created_at: string;
};

export function getStoryChapters(storyId: string) {
  return apiFetch<ApiChapter[]>(`/stories/${storyId}/chapters`);
}

export function getChapterByNumber(storyId: string, number: number) {
  return apiFetch<ApiChapter>(`/stories/${storyId}/chapters/by-number?number=${number}`);
}

export function getChapterCount(storyId: string) {
  return apiFetch<{ count: number }>(`/stories/${storyId}/chapters/count`);
}

export function createChapter(storyId: string, title: string) {
  return apiFetch<ApiChapter>(`/stories/${storyId}/chapters`, {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export function updateChapter(storyId: string, chapterId: string, title: string) {
  return apiFetch<ApiChapter>(`/stories/${storyId}/chapters/${chapterId}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  });
}

export function getComicPages(storyId: string) {
  return apiFetch<ApiComicPage[]>(`/stories/${storyId}/comic-pages`);
}

export function replaceComicPages(
  storyId: string,
  pages: { image_url: string; page_order: number }[],
) {
  return apiFetch<ApiComicPage[]>(`/stories/${storyId}/comic-pages`, {
    method: 'PUT',
    body: JSON.stringify({ pages }),
  });
}

export function appendComicPage(
  storyId: string,
  page: { image_url: string; page_order: number },
) {
  return apiFetch<ApiComicPage[]>(`/stories/${storyId}/comic-pages/append`, {
    method: 'POST',
    body: JSON.stringify(page),
  });
}

export function getBlocks(storyId: string, chapterId?: string | null) {
  const params = chapterId ? `?chapter_id=${chapterId}` : '';
  return apiFetch<ApiBlock[]>(`/stories/${storyId}/blocks${params}`);
}

export function replaceBlocks(
  storyId: string,
  blocks: { block_type: string; content: string }[],
  chapterId?: string | null,
) {
  const params = chapterId ? `?chapter_id=${chapterId}` : '';
  return apiFetch<ApiBlock[]>(`/stories/${storyId}/blocks${params}`, {
    method: 'PUT',
    body: JSON.stringify({ blocks }),
  });
}

export function updateStory(storyId: string, body: Record<string, unknown>) {
  return apiFetch<ApiStory>(`/stories/${storyId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}
