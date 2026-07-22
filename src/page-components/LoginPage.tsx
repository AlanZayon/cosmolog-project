'use client';

import { Suspense } from 'react';
import { AuthPageShell } from '@/components/auth/AuthPageShell';
import { LoginForm } from '@/components/auth/LoginForm';
import { useLanguage } from '@/hooks/useLanguage';

function LoginPageContent() {
  const { t } = useLanguage();

  return (
    <AuthPageShell title={t('login.welcome')} subtitle={t('login.subtitle')}>
      <LoginForm />
    </AuthPageShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
