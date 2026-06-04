import { cn } from '@/lib/utils';

/** Orange unread indicator (matches bell icon dot — uses theme primary). */
export function ActivityNotificationUnreadDot({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'pointer-events-none absolute right-0 top-0 z-[1] h-2 w-2 rounded-full bg-primary ring-2 ring-background',
        className,
      )}
      aria-hidden
    />
  );
}

export function ActivityNotificationAvatarBadge({
  children,
  hasUnread,
  className,
}: {
  children: React.ReactNode;
  hasUnread: boolean;
  className?: string;
}) {
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      {children}
      {hasUnread ? <ActivityNotificationUnreadDot /> : null}
    </span>
  );
}
