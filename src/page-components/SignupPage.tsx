'use client';

import { Suspense } from 'react';
import { AuthPageShell } from '@/components/auth/AuthPageShell';
import { SignupForm } from '@/components/auth/SignupForm';
import { useLanguage } from '@/hooks/useLanguage';

function SignupPageContent() {
  const { t } = useLanguage();

  return (
    <AuthPageShell title={t('signup.title')} subtitle={t('signup.subtitle')} wide>
      <SignupForm />
    </AuthPageShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <SignupPageContent />
    </Suspense>
  );
}
