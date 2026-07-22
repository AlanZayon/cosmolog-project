'use client';

import { useLanguage } from '@/hooks/useLanguage';
import { evaluatePassword } from '@/lib/auth/passwordStrength';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';

type PasswordStrengthIndicatorProps = {
  password: string;
};

const REQUIREMENT_KEYS = [
  'signup.passwordReq.length',
  'signup.passwordReq.lower',
  'signup.passwordReq.upper',
  'signup.passwordReq.digit',
  'signup.passwordReq.special',
] as const;

const CHECK_ORDER = ['length', 'lower', 'upper', 'digit', 'special'] as const;

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const { t } = useLanguage();

  if (!password) return null;

  const strength = evaluatePassword(password);
  const progressValue = (strength.score / 5) * 100;

  const labelKey =
    strength.label === 'strong'
      ? 'signup.passwordStrength.strong'
      : strength.label === 'fair'
        ? 'signup.passwordStrength.fair'
        : 'signup.passwordStrength.weak';

  return (
    <div className="space-y-2 rounded-md border border-border/60 bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{t('signup.passwordStrength.label')}</span>
        <span
          className={cn(
            'font-medium',
            strength.label === 'strong' && 'text-green-600 dark:text-green-400',
            strength.label === 'fair' && 'text-amber-600 dark:text-amber-400',
            strength.label === 'weak' && 'text-destructive',
          )}
        >
          {t(labelKey)}
        </span>
      </div>
      <Progress value={progressValue} className="h-1.5" />
      <ul className="space-y-1">
        {CHECK_ORDER.map((key, index) => {
          const met = strength.checks[key];
          return (
            <li key={key} className="flex items-start gap-2 text-xs text-muted-foreground">
              {met ? (
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600 dark:text-green-400" aria-hidden />
              ) : (
                <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
              )}
              <span className={cn(met && 'text-foreground')}>{t(REQUIREMENT_KEYS[index])}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
