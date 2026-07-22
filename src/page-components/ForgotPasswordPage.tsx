'use client';

import { useState } from 'react';
import Link from 'next/link';

import { AuthPageShell } from '@/components/auth/AuthPageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/use-toast';
import { requestPasswordReset } from '@/lib/api/auth';

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { t } = useLanguage();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedEmail = email.trim();
    if (!isValidEmail(trimmedEmail)) {
      toast({
        title: t('forgotPassword.title'),
        description: t('auth.errors.invalidEmail'),
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      await requestPasswordReset(trimmedEmail);
    } catch {
      // Always show the same message (anti-enumeration).
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <AuthPageShell title={t('forgotPassword.title')} subtitle={t('forgotPassword.subtitle')}>
      {sent ? (
        <p className="text-pretty text-center text-sm text-muted-foreground">
          {t('forgotPassword.success')}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="forgot-email" className="sr-only">
              {t('login.email')}
            </Label>
            <Input
              id="forgot-email"
              type="email"
              autoComplete="email"
              placeholder={t('login.email')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <Button
            type="submit"
            className="gradient-warm w-full text-primary-foreground"
            disabled={loading}
          >
            {loading ? t('forgotPassword.submitting') : t('forgotPassword.submit')}
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
