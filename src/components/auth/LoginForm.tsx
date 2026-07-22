'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { GoogleAuthButton } from '@/components/auth/GoogleAuthButton';
import { resolveAuthErrorMessage, resolveOAuthUrlError } from '@/lib/auth/errors';
import { useAuthNavigation } from '@/lib/auth/navigation';
import { buildAuthHref, sanitizeRedirectPath } from '@/lib/auth/redirect';

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const { signIn } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { completeAuth } = useAuthNavigation();
  const { toast } = useToast();
  const oauthErrorShown = useRef(false);

  const redirectPath = sanitizeRedirectPath(searchParams.get('redirect'));
  const signupHref = buildAuthHref('/signup', redirectPath);

  useEffect(() => {
    const errorCode = searchParams.get('error');
    const confirmed = searchParams.get('confirmed');
    if ((!errorCode && !confirmed) || oauthErrorShown.current) return;
    oauthErrorShown.current = true;
    if (errorCode) {
      const description = resolveOAuthUrlError(errorCode, t);
      if (description) {
        toast({ title: t('login.error'), description, variant: 'destructive' });
      }
    } else if (confirmed) {
      toast({
        title: t('auth.emailConfirmed.title'),
        description: t('auth.emailConfirmed.description'),
      });
    }
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('error');
    nextParams.delete('confirmed');
    const query = nextParams.toString();
    router.replace(query ? `/login?${query}` : '/login');
  }, [searchParams, router, t, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast({
        title: t('login.error'),
        description: t('auth.errors.emailRequired'),
        variant: 'destructive',
      });
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      toast({
        title: t('login.error'),
        description: t('auth.errors.invalidEmail'),
        variant: 'destructive',
      });
      return;
    }

    if (!password) {
      toast({
        title: t('login.error'),
        description: t('auth.errors.passwordRequired'),
        variant: 'destructive',
      });
      return;
    }

    setEmailLoading(true);
    try {
      await signIn(trimmedEmail, password);
      completeAuth(redirectPath);
    } catch (err: unknown) {
      toast({
        title: t('login.error'),
        description: resolveAuthErrorMessage(err, 'login', t),
        variant: 'destructive',
      });
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <GoogleAuthButton redirectPath={redirectPath} disabled={emailLoading} />
      <div className="relative">
        <Separator />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
          {t('auth.or')}
        </span>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="login-email" className="sr-only">
            {t('login.email')}
          </Label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder={t('login.email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={emailLoading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="login-password" className="sr-only">
            {t('login.password')}
          </Label>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder={t('login.password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={emailLoading}
          />
        </div>
        <div className="text-right">
          <Link
            href="/forgot-password"
            className="text-sm text-muted-foreground hover:text-primary hover:underline"
          >
            {t('login.forgotPassword')}
          </Link>
        </div>
        <Button
          type="submit"
          className="gradient-warm w-full text-primary-foreground"
          disabled={emailLoading}
        >
          {emailLoading ? t('login.submitting') : t('login.submit')}
        </Button>
      </form>
      <p className="text-pretty text-center text-sm text-muted-foreground">
        {t('login.noAccount')}{' '}
        <Link href={signupHref} className="font-medium text-primary hover:underline">
          {t('login.signupLink')}
        </Link>
      </p>
    </div>
  );
}
