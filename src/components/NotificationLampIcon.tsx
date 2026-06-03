import { Lightbulb, LightbulbOff } from 'lucide-react';

import { cn } from '@/lib/utils';

type NotificationLampIconProps = {
  active: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
};

export default function NotificationLampIcon({
  active,
  className,
  size = 'md',
}: NotificationLampIconProps) {
  const sizeClass = size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-7 w-7' : 'h-4 w-4';

  if (active) {
    return (
      <Lightbulb
        className={cn(
          sizeClass,
          'fill-amber-300/90 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.45)]',
          className,
        )}
        aria-hidden
      />
    );
  }

  return <LightbulbOff className={cn(sizeClass, 'text-muted-foreground', className)} aria-hidden />;
}
