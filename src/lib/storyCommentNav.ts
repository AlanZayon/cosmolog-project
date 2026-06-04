/** Story page URL that scrolls to a specific comment (or reply). */
export function storyCommentPath(storyId: string, commentId?: string | null): string {
  if (!commentId) return `/story/${storyId}`;
  return `/story/${storyId}?comment=${encodeURIComponent(commentId)}`;
}
