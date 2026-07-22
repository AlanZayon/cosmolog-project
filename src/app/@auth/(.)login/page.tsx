'use client';

import { Suspense } from 'react';
import { AuthDialog } from '@/components/auth/AuthDialog';
import { LoginForm } from '@/components/auth/LoginForm';
import { useLanguage } from '@/hooks/useLanguage';

function LoginModalContent() {
  const { t } = useLanguage();

  return (
    <AuthDialog title={t('login.welcome')} description={t('login.subtitle')}>
      <LoginForm />
    </AuthDialog>
  );
}

export default function LoginModalPage() {
  return (
    <Suspense fallback={null}>
      <LoginModalContent />
    </Suspense>
  );
}
