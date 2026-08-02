'use client';

import { Suspense } from 'react';
import { AuthPageShell } from '@/components/auth/AuthPageShell';
import { SignupForm } from '@/components/auth/SignupForm';
import AuthRouteLoadingFallback from '@/components/loading/AuthRouteLoadingFallback';
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
    <Suspense fallback={<AuthRouteLoadingFallback />}>
      <SignupPageContent />
    </Suspense>
  );
}
