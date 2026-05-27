'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Heart, MessageCircle, Send, X } from 'lucide-react';
import { ApiError } from '@/lib/api';
import {
  createComment,
  getStoryComments,
  toggleCommentLike,
  type ApiComment,
} from '@/lib/api/social';
import { CONTENT_LIMITS } from '@/lib/contentLimits';
import { formatCommentRelative } from '@/lib/formatDate';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import CharacterMeter from '@/components/CharacterMeter';
import { cn } from '@/lib/utils';
import {
  groupCommentsByThread,
  getReplyWindow,
  initialVisibleReplyCount,
  REPLIES_LOAD_MORE_STEP,
} from '@/lib/commentThreads';

type ReplyTarget = {
  /** Top-level comment this reply belongs under (Instagram: one thread depth). */
  threadRootId: string;
  mentionUsername: string;
};

function prependMention(content: string, username: string): string {
  const trimmed = content.trim();
  const mention = `@${username}`;
  if (trimmed.startsWith(`${mention} `) || trimmed === mention) {
    return trimmed;
  }
  return `${mention} ${trimmed}`;
}

function CommentAvatar({ name, size = 'md' }: { name: string; size?: 'md' | 'sm' }) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold',
        'bg-gradient-to-br from-primary/25 via-primary/10 to-accent/40 text-primary',
        'ring-1 ring-primary/15',
        size === 'md' ? 'h-9 w-9 text-sm' : 'h-7 w-7 text-xs',
      )}
      aria-hidden
    >
      {initial}
    </div>
  );
}

function CommentContent({ content }: { content: string }) {
  const match = content.match(/^@(\S+)(?:\s+(.*))?$/s);
  if (!match) {
    return <span className="text-foreground/90">{content}</span>;
  }
  const [, mention, rest] = match;
  return (
    <>
      <span className="font-medium text-primary">@{mention}</span>
      {rest ? (
        <>
          {' '}
          <span className="text-foreground/90">{rest}</span>
        </>
      ) : null}
    </>
  );
}

function updateCommentInTree(
  comments: ApiComment[],
  commentId: string,
  updater: (comment: ApiComment) => ApiComment,
): ApiComment[] {
  return comments.map((c) => (c.id === commentId ? updater(c) : c));
}

type CommentRowProps = {
  comment: ApiComment;
  storyId: string;
  variant: 'drawer' | 'inline';
  isReply?: boolean;
  threadRootId: string;
  onReply: (target: ReplyTarget) => void;
  onLikeToggle: (commentId: string, liked: boolean, likesCount: number) => void;
};

function CommentRow({
  comment,
  storyId,
  variant,
  isReply = false,
  threadRootId,
  onReply,
  onLikeToggle,
}: CommentRowProps) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [liking, setLiking] = useState(false);
  const username = comment.username || t('common.anonymous');
  const when = formatCommentRelative(comment.created_at, language);

  const handleLike = async () => {
    if (!user) {
      toast({ title: t('story.loginToLikeComment'), variant: 'destructive' });
      return;
    }
    if (liking) return;
    setLiking(true);
    const prevLiked = Boolean(comment.liked);
    const prevCount = comment.likes_count ?? 0;
    const nextLiked = !prevLiked;
    const nextCount = Math.max(0, prevCount + (nextLiked ? 1 : -1));
    onLikeToggle(comment.id, nextLiked, nextCount);
    try {
      const { liked } = await toggleCommentLike(storyId, comment.id);
      onLikeToggle(comment.id, liked, liked ? prevCount + 1 : Math.max(0, prevCount - 1));
    } catch (err) {
      onLikeToggle(comment.id, prevLiked, prevCount);
      const message = err instanceof ApiError ? err.message : String(err);
      toast({ title: t('common.error'), description: message, variant: 'destructive' });
    } finally {
      setLiking(false);
    }
  };

  const likeCount = comment.likes_count ?? 0;

  const replyButton = (
    <button
      type="button"
      className="font-semibold text-muted-foreground transition-colors hover:text-primary"
      onClick={() =>
        onReply({
          threadRootId,
          mentionUsername: username,
        })
      }
    >
      {t('comments.reply')}
    </button>
  );

  const likeButton = (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1 font-semibold transition-colors disabled:opacity-50',
        comment.liked ? 'text-destructive' : 'text-muted-foreground hover:text-destructive',
      )}
      aria-label={`${t('comments.likeComment')}, ${likeCount}`}
      onClick={handleLike}
      disabled={liking}
    >
      <Heart className={cn('h-3.5 w-3.5', comment.liked && 'fill-current')} aria-hidden />
      {likeCount > 0 ? <span className="tabular-nums">{likeCount}</span> : null}
    </button>
  );

  if (variant === 'inline') {
    return (
      <div className={cn('flex gap-3 py-1', isReply && 'pt-2')}>
        <CommentAvatar name={username} size={isReply ? 'sm' : 'md'} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-relaxed text-foreground/90">
            <span className="mr-1.5 font-semibold text-foreground">{username}</span>
            <CommentContent content={comment.content} />
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {when ? <span className="text-muted-foreground">{when}</span> : null}
            {replyButton}
            {likeButton}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex gap-3 py-2', isReply && 'pl-8')}>
      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
        {username.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          <span className="font-semibold text-foreground">{username}</span>{' '}
          <CommentContent content={comment.content} />
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {when ? <span>{when}</span> : null}
          {replyButton}
        </div>
      </div>
      <button
        type="button"
        className="flex shrink-0 flex-col items-center gap-0.5 pt-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
        aria-label={`${t('comments.likeComment')}, ${likeCount}`}
        onClick={handleLike}
        disabled={liking}
      >
        <Heart
          className={cn('h-4 w-4', comment.liked && 'fill-current text-destructive')}
          aria-hidden
        />
        {likeCount > 0 ? <span className="text-[10px] tabular-nums">{likeCount}</span> : null}
      </button>
    </div>
  );
}

type CommentThreadBlockProps = {
  rootComment: ApiComment;
  replies: ApiComment[];
  storyId: string;
  variant: 'drawer' | 'inline';
  visibleCount: number;
  onLoadMore: () => void;
  onReply: (target: ReplyTarget) => void;
  onLikeToggle: (commentId: string, liked: boolean, likesCount: number) => void;
};

function LoadMoreRepliesButton({
  variant,
  loadMoreCount,
  onLoadMore,
}: {
  variant: 'drawer' | 'inline';
  loadMoreCount: number;
  onLoadMore: () => void;
}) {
  const { t } = useLanguage();
  const indentClass = variant === 'inline' ? 'ml-11' : 'pl-8';

  if (loadMoreCount <= 0) return null;

  const label =
    loadMoreCount === 1
      ? t('comments.viewOneMoreReply')
      : t('comments.viewMoreReplies').replace(/\{\{n\}\}/g, String(loadMoreCount));

  return (
    <button
      type="button"
      className={cn(
        'flex items-center gap-2 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground',
        indentClass,
      )}
      onClick={onLoadMore}
    >
      <span className="h-px w-5 shrink-0 bg-border" aria-hidden />
      {label}
    </button>
  );
}

function CommentThreadBlock({
  rootComment,
  replies,
  storyId,
  variant,
  visibleCount,
  onLoadMore,
  onReply,
  onLikeToggle,
}: CommentThreadBlockProps) {
  const { visible, loadMoreCount } = getReplyWindow(replies, visibleCount);

  const replyRows = visible.map((reply) => (
    <CommentRow
      key={reply.id}
      comment={reply}
      storyId={storyId}
      variant={variant}
      threadRootId={rootComment.id}
      isReply
      onReply={onReply}
      onLikeToggle={onLikeToggle}
    />
  ));

  const repliesBlock =
    replies.length > 0 ? (
      <>
        {variant === 'inline' && visible.length > 0 ? (
          <div className="ml-11 mt-1 space-y-0 border-l-2 border-primary/10 pl-3.5">{replyRows}</div>
        ) : variant === 'drawer' ? (
          replyRows
        ) : null}
        <LoadMoreRepliesButton
          variant={variant}
          loadMoreCount={loadMoreCount}
          onLoadMore={onLoadMore}
        />
      </>
    ) : null;

  if (variant === 'inline') {
    return (
      <article className="rounded-xl border border-border/50 bg-background/60 p-3.5 shadow-sm transition-colors hover:border-border/80 sm:p-4">
        <CommentRow
          comment={rootComment}
          storyId={storyId}
          variant="inline"
          threadRootId={rootComment.id}
          onReply={onReply}
          onLikeToggle={onLikeToggle}
        />
        {repliesBlock}
      </article>
    );
  }

  return (
    <div>
      <CommentRow
        comment={rootComment}
        storyId={storyId}
        variant="drawer"
        threadRootId={rootComment.id}
        onReply={onReply}
        onLikeToggle={onLikeToggle}
      />
      {repliesBlock}
    </div>
  );
}

export type StoryCommentsPanelProps = {
  storyId: string;
  storyTitle?: string;
  /** Drawer: header + scroll list + bottom input. Inline: scroll list + bottom input (story page). */
  variant?: 'drawer' | 'inline';
  className?: string;
  onCommentCreated?: () => void;
  /** Focus the composer when mounted (e.g. feed deep-link to comments). */
  autoFocusInput?: boolean;
};

export default function StoryCommentsPanel({
  storyId,
  storyTitle,
  variant = 'drawer',
  className,
  onCommentCreated,
  autoFocusInput = false,
}: StoryCommentsPanelProps) {
  const { user, loading: authLoading, profile } = useAuth();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [comments, setComments] = useState<ApiComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [visibleReplyCounts, setVisibleReplyCounts] = useState<Record<string, number>>({});

  const loadComments = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await getStoryComments(storyId);
      setComments(rows);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err);
      setLoadError(message);
      toast({
        title: t('story.commentsLoadError'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [storyId, t, toast]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  useEffect(() => {
    setReplyTarget(null);
    setDraft('');
    setVisibleReplyCounts({});
  }, [storyId]);

  useEffect(() => {
    if (!autoFocusInput || authLoading || !user) return;
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [autoFocusInput, authLoading, user, storyId]);

  const { topLevel, repliesByParent } = useMemo(
    () => groupCommentsByThread(comments),
    [comments],
  );

  const handleLikeToggle = useCallback(
    (commentId: string, liked: boolean, likesCount: number) => {
      setComments((prev) =>
        updateCommentInTree(prev, commentId, (c) => ({ ...c, liked, likes_count: likesCount })),
      );
    },
    [],
  );

  const handleReply = useCallback((target: ReplyTarget) => {
    setReplyTarget(target);
    inputRef.current?.focus();
  }, []);

  const getThreadVisibleCount = useCallback(
    (threadId: string, replyCount: number) => {
      const stored = visibleReplyCounts[threadId];
      if (stored !== undefined) return Math.min(stored, replyCount);
      return initialVisibleReplyCount(replyCount);
    },
    [visibleReplyCounts],
  );

  const loadMoreReplies = useCallback((threadId: string, replyCount: number) => {
    setVisibleReplyCounts((prev) => {
      const current = prev[threadId] ?? initialVisibleReplyCount(replyCount);
      const next = Math.min(current + REPLIES_LOAD_MORE_STEP, replyCount);
      if (next === current) return prev;
      return { ...prev, [threadId]: next };
    });
  }, []);

  const revealThroughLatestReply = useCallback((threadId: string, replyCount: number) => {
    setVisibleReplyCounts((prev) => {
      const current = prev[threadId] ?? initialVisibleReplyCount(replyCount);
      const next = Math.max(current, replyCount);
      if (next === current) return prev;
      return { ...prev, [threadId]: next };
    });
  }, []);

  const cancelReply = () => setReplyTarget(null);

  const draftOverLimit = draft.length > CONTENT_LIMITS.commentBody;
  const submitDisabled = !draft.trim() || draftOverLimit || submitting;
  const showCharMeter = draft.length > CONTENT_LIMITS.commentBody * 0.8;
  const composerName = profile?.username || user?.email?.split('@')[0] || t('common.anonymous');

  const submitComment = async () => {
    if (!user) {
      toast({ title: t('story.loginToComment'), variant: 'destructive' });
      return;
    }
    const trimmed = draft.trim();
    if (!trimmed || draftOverLimit) return;

    setSubmitting(true);
    try {
      const parentId = replyTarget?.threadRootId ?? null;
      const content = replyTarget
        ? prependMention(trimmed, replyTarget.mentionUsername)
        : trimmed;
      const created = await createComment(storyId, content, parentId);
      if (parentId) {
        revealThroughLatestReply(parentId, (repliesByParent.get(parentId)?.length ?? 0) + 1);
      }
      setComments((prev) => {
        const next = [...prev, created];
        return next;
      });
      setDraft('');
      setReplyTarget(null);
      onCommentCreated?.();
      void loadComments();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          toast({ title: t('story.loginToComment'), variant: 'destructive' });
        } else if (
          err.status === 400 &&
          (err.message.includes('4000') || err.message.toLowerCase().includes('at most'))
        ) {
          toast({
            title: t('validation.charLimitsTitle'),
            description: t('story.commentTooLong'),
            variant: 'destructive',
          });
        } else {
          toast({
            title: t('common.error'),
            description: err.message,
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: t('common.error'),
          description: err instanceof Error ? err.message : String(err),
          variant: 'destructive',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderThreads = (layoutVariant: 'drawer' | 'inline') => (
    <div className={layoutVariant === 'inline' ? 'space-y-5' : 'divide-y divide-border/60'}>
      {topLevel.map((comment) => {
        const replies = repliesByParent.get(comment.id) ?? [];
        return (
          <CommentThreadBlock
            key={comment.id}
            rootComment={comment}
            replies={replies}
            storyId={storyId}
            variant={layoutVariant}
            visibleCount={getThreadVisibleCount(comment.id, replies.length)}
            onLoadMore={() => loadMoreReplies(comment.id, replies.length)}
            onReply={handleReply}
            onLikeToggle={handleLikeToggle}
          />
        );
      })}
    </div>
  );

  const threadList =
    loading ? (
      <div
        className={cn(
          'space-y-4',
          variant === 'drawer' ? 'py-8' : 'py-2',
        )}
      >
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex animate-pulse gap-3">
            <div className="h-9 w-9 shrink-0 rounded-full bg-muted" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-3 w-24 rounded-full bg-muted" />
              <div className="h-3 w-full max-w-md rounded-full bg-muted/70" />
            </div>
          </div>
        ))}
      </div>
    ) : loadError ? (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {loadError}
      </div>
    ) : topLevel.length === 0 ? (
      <div
        className={cn(
          'flex flex-col items-center text-center',
          variant === 'drawer' ? 'py-10' : 'py-8',
        )}
      >
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/80 ring-1 ring-border/60">
          <MessageCircle className="h-5 w-5 text-muted-foreground/70" aria-hidden />
        </div>
        <p className="text-sm font-medium text-foreground/80">{t('story.noComments')}</p>
      </div>
    ) : (
      renderThreads(variant)
    );

  const loginCta =
    !authLoading && !user ? (
      <div
        className={cn(
          'rounded-xl border border-dashed border-border/80 bg-background/90 text-sm text-muted-foreground',
          variant === 'inline' ? 'px-4 py-5 text-center' : 'mb-4',
        )}
      >
        {t('story.loginToCommentHint')}{' '}
        <Link href="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
          {t('header.login')}
        </Link>
        {variant === 'inline' ? (
          <>
            <span className="mx-1.5 text-border">·</span>
            <Link href="/signup" className="font-semibold text-primary underline-offset-4 hover:underline">
              {t('header.signup')}
            </Link>
          </>
        ) : null}
      </div>
    ) : null;

  const composerBody = (
    <>
      {replyTarget ? (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-primary/5 px-3 py-2 text-xs text-muted-foreground ring-1 ring-primary/10">
          <span>
            {t('comments.replyingTo')}{' '}
            <span className="font-semibold text-primary">@{replyTarget.mentionUsername}</span>
          </span>
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground"
            aria-label={t('comments.cancelReply')}
            onClick={cancelReply}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
      <div className="flex items-end gap-3">
        {variant === 'inline' ? <CommentAvatar name={composerName} /> : null}
        <div className="min-w-0 flex-1 space-y-2">
          <Textarea
            ref={inputRef}
            placeholder={
              replyTarget ? t('comments.replyPlaceholder') : t('story.commentPlaceholder')
            }
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={variant === 'inline' ? 2 : 1}
            className={cn(
              'flex-1 resize-none',
              variant === 'inline'
                ? 'min-h-[3rem] rounded-xl border-border/70 bg-background px-3 py-2.5 shadow-sm focus-visible:ring-primary/30'
                : 'min-h-[2.5rem] py-2',
            )}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!submitDisabled) void submitComment();
              }
            }}
          />
          <div className="flex items-center justify-end gap-2">
            {variant === 'inline' && showCharMeter ? (
              <CharacterMeter
                length={draft.length}
                max={CONTENT_LIMITS.commentBody}
                className="mr-auto text-left text-xs"
              />
            ) : null}
            <Button
              size="sm"
              disabled={submitDisabled}
              className={cn(
                'gradient-warm shrink-0 text-primary-foreground',
                variant === 'inline' && 'h-9 gap-1.5 px-4',
              )}
              onClick={() => void submitComment()}
            >
              {variant === 'inline' ? (
                <>
                  <Send className="h-3.5 w-3.5" aria-hidden />
                  {submitting ? t('story.postingComment') : t('common.send')}
                </>
              ) : submitting ? (
                t('story.postingComment')
              ) : (
                t('common.send')
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );

  const composer =
    user ? (
      variant === 'inline' ? (
        <div className="rounded-xl border border-border/70 bg-background p-3 shadow-sm sm:p-4">
          {composerBody}
        </div>
      ) : (
        <div className="space-y-2">
          {composerBody}
          <CharacterMeter
            length={draft.length}
            max={CONTENT_LIMITS.commentBody}
            className="text-right"
          />
        </div>
      )
    ) : null;

  if (variant === 'inline') {
    return (
      <div className={cn('space-y-5', className)}>
        {threadList}
        {loginCta ?? composer}
      </div>
    );
  }

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div className="shrink-0 border-b border-border px-4 pb-3 pt-1">
        <h2 className="text-center text-base font-semibold">{t('story.comments')}</h2>
        {storyTitle ? (
          <p className="mt-1 truncate text-center text-xs text-muted-foreground">{storyTitle}</p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2">{threadList}</div>

      <div className="shrink-0 border-t border-border bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {loginCta ?? composer}
      </div>
    </div>
  );
}
