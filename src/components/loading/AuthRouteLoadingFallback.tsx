'use client';

import { useLanguage } from '@/hooks/useLanguage';

/** Minimal auth-route Suspense fallback (no app Header). */
export default function AuthRouteLoadingFallback() {
  const { t } = useLanguage();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
    </div>
  );
}
