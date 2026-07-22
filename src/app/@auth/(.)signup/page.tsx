'use client';

import { Suspense } from 'react';
import { AuthDialog } from '@/components/auth/AuthDialog';
import { SignupForm } from '@/components/auth/SignupForm';
import { useLanguage } from '@/hooks/useLanguage';

function SignupModalContent() {
  const { t } = useLanguage();

  return (
    <AuthDialog title={t('signup.title')} description={t('signup.subtitle')} wide>
      <SignupForm />
    </AuthDialog>
  );
}

export default function SignupModalPage() {
  return (
    <Suspense fallback={null}>
      <SignupModalContent />
    </Suspense>
  );
}
