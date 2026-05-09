import { cn } from '@/lib/utils';

type CharacterMeterProps = {
  length: number;
  max: number;
  className?: string;
};

/** Inline current length vs max; turns destructive when over limit (save should stay disabled). */
export default function CharacterMeter({ length, max, className }: CharacterMeterProps) {
  const over = length > max;
  return (
    <p
      role="status"
      className={cn('text-xs tabular-nums', over ? 'font-medium text-destructive' : 'text-muted-foreground', className)}
    >
      {length} / {max}
    </p>
  );
}
