import type { ApiComment } from '@/lib/api/types';

/** Walk up parent_id chain and return the top-level comment id (Instagram thread root). */
export function getThreadRootId(
  comment: ApiComment,
  byId: Map<string, ApiComment>,
): string | null {
  if (!comment.parent_id) return null;

  let parentId: string | null = comment.parent_id;
  for (let depth = 0; parentId && depth < 64; depth += 1) {
    const parent = byId.get(parentId);
    if (!parent?.parent_id) {
      return parentId;
    }
    parentId = parent.parent_id;
  }

  return comment.parent_id;
}

/** Flatten reply-to-reply so every reply points at the top-level comment id. */
export function flattenCommentParents(comments: ApiComment[]): ApiComment[] {
  const byId = new Map(comments.map((c) => [c.id, c]));
  return comments.map((comment) => {
    if (!comment.parent_id) return comment;
    const rootId = getThreadRootId(comment, byId);
    if (!rootId || rootId === comment.parent_id) return comment;
    return { ...comment, parent_id: rootId };
  });
}

export function groupCommentsByThread(comments: ApiComment[]) {
  const flat = flattenCommentParents(comments);
  const topLevel = flat.filter((c) => !c.parent_id);
  const repliesByParent = new Map<string, ApiComment[]>();

  for (const comment of flat) {
    if (!comment.parent_id) continue;
    const list = repliesByParent.get(comment.parent_id) ?? [];
    list.push(comment);
    repliesByParent.set(comment.parent_id, list);
  }

  topLevel.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  for (const replies of repliesByParent.values()) {
    replies.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }

  return { topLevel, repliesByParent };
}

/** How many replies show before the user loads more. */
export const INITIAL_REPLIES_VISIBLE = 2;

/** Replies revealed each time the user taps "load more". */
export const REPLIES_LOAD_MORE_STEP = 5;

export function initialVisibleReplyCount(totalReplies: number): number {
  if (totalReplies <= INITIAL_REPLIES_VISIBLE) return totalReplies;
  return INITIAL_REPLIES_VISIBLE;
}

/** Slice replies for Instagram-style incremental expansion. */
export function getReplyWindow(replies: ApiComment[], visibleCount: number) {
  const total = replies.length;
  const clamped = Math.min(Math.max(visibleCount, 0), total);
  const hiddenCount = total - clamped;
  const loadMoreCount = Math.min(REPLIES_LOAD_MORE_STEP, hiddenCount);

  return {
    visible: replies.slice(0, clamped),
    hiddenCount,
    loadMoreCount,
    hasMore: hiddenCount > 0,
  };
}
