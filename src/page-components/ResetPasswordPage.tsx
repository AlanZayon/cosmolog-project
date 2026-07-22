'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { AuthPageShell } from '@/components/auth/AuthPageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/use-toast';
import { ApiError } from '@/lib/api/client';
import { resetPassword } from '@/lib/api/auth';

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (password.length < MIN_PASSWORD_LENGTH) {
      toast({
        title: t('resetPassword.error'),
        description: t('auth.errors.passwordTooShort'),
        variant: 'destructive',
      });
      return;
    }
    if (password !== confirmPassword) {
      toast({
        title: t('resetPassword.error'),
        description: t('signup.passwordMismatch'),
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, password);
      toast({ title: t('resetPassword.success') });
      // Full reload so the auth provider picks up the new session cookies.
      window.location.assign('/');
    } catch (err: unknown) {
      const description =
        err instanceof ApiError && err.message.trim().toLowerCase() === 'invalid_token'
          ? t('auth.errors.invalidToken')
          : t('auth.errors.unknown');
      toast({
        title: t('resetPassword.error'),
        description,
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  return (
    <AuthPageShell title={t('resetPassword.title')} subtitle={t('resetPassword.subtitle')}>
      {!token ? (
        <p className="text-pretty text-center text-sm text-muted-foreground">
          {t('resetPassword.missingToken')}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reset-password" className="sr-only">
              {t('resetPassword.newPassword')}
            </Label>
            <Input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              placeholder={t('resetPassword.newPassword')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reset-password-confirm" className="sr-only">
              {t('signup.confirmPassword')}
            </Label>
            <Input
              id="reset-password-confirm"
              type="password"
              autoComplete="new-password"
              placeholder={t('signup.confirmPassword')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <Button
            type="submit"
            className="gradient-warm w-full text-primary-foreground"
            disabled={loading}
          >
            {loading ? t('resetPassword.submitting') : t('resetPassword.submit')}
          </Button>
        </form>
      )}
      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t('forgotPassword.backToLogin')}
        </Link>
      </p>
    </AuthPageShell>
  );
}
