'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { GoogleIcon } from '@/components/icons/GoogleIcon';
import { useLanguage } from '@/hooks/useLanguage';

type GoogleAuthButtonProps = {
  redirectPath: string;
  disabled?: boolean;
};

export function GoogleAuthButton({ redirectPath, disabled = false }: GoogleAuthButtonProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);

  const handleClick = () => {
    setLoading(true);
    const params = new URLSearchParams();
    const safe = redirectPath.startsWith('/') && !redirectPath.startsWith('//') ? redirectPath : '/';
    if (safe !== '/') params.set('redirect', safe);
    window.location.href = `/api/auth/google/start?${params.toString()}`;
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full gap-2"
      onClick={handleClick}
      disabled={disabled || loading}
    >
      <GoogleIcon className="h-4 w-4 shrink-0" />
      <span className="truncate">{loading ? t('auth.google.loading') : t('auth.google.continue')}</span>
    </Button>
  );
}
