'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { GoogleAuthButton } from '@/components/auth/GoogleAuthButton';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { maxBirthDateForMinAge, isAtLeastAge } from '@/lib/auth/age';
import { evaluatePassword } from '@/lib/auth/passwordStrength';
import { resolveAuthErrorMessage } from '@/lib/auth/errors';
import { useAuthNavigation } from '@/lib/auth/navigation';
import { buildAuthHref, sanitizeRedirectPath } from '@/lib/auth/redirect';

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function SignupForm() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const { signUp } = useAuth();
  const { t } = useLanguage();
  const { completeAuth } = useAuthNavigation();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const redirectPath = sanitizeRedirectPath(searchParams.get('redirect'));
  const loginHref = buildAuthHref('/login', redirectPath);
  const maxBirthDate = useMemo(() => maxBirthDateForMinAge(18), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      toast({
        title: t('signup.error'),
        description: t('signup.nameRequired'),
        variant: 'destructive',
      });
      return;
    }

    if (!dateOfBirth || !isAtLeastAge(dateOfBirth, 18)) {
      toast({
        title: t('signup.error'),
        description: t('signup.ageRequired'),
        variant: 'destructive',
      });
      return;
    }

    const strength = evaluatePassword(password);
    if (!strength.isStrong) {
      toast({
        title: t('signup.error'),
        description: t('signup.passwordWeak'),
        variant: 'destructive',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: t('signup.error'),
        description: t('signup.passwordMismatch'),
        variant: 'destructive',
      });
      return;
    }

    if (!acceptedTerms) {
      toast({
        title: t('signup.error'),
        description: t('signup.termsRequired'),
        variant: 'destructive',
      });
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast({
        title: t('signup.error'),
        description: t('auth.errors.emailRequired'),
        variant: 'destructive',
      });
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      toast({
        title: t('signup.error'),
        description: t('auth.errors.invalidEmail'),
        variant: 'destructive',
      });
      return;
    }

    setEmailLoading(true);
    try {
      const result = await signUp({
        email: trimmedEmail,
        password,
        fullName: trimmedName,
        dateOfBirth,
      });
      if ('pending_email_confirmation' in result && result.pending_email_confirmation) {
        toast({ title: t('signup.success'), description: t('signup.confirmEmail') });
        completeAuth(loginHref);
        return;
      }
      toast({ title: t('signup.success'), description: t('signup.completeProfileHint') });
      completeAuth('/profile?complete=1');
    } catch (err: unknown) {
      toast({
        title: t('signup.error'),
        description: resolveAuthErrorMessage(err, 'signup', t),
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
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="signup-name">{t('signup.name')}</Label>
          <Input
            id="signup-name"
            placeholder={t('signup.namePlaceholder')}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            maxLength={100}
            disabled={emailLoading}
            autoComplete="name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-email">{t('login.email')}</Label>
          <Input
            id="signup-email"
            type="email"
            placeholder={t('login.email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={emailLoading}
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-dob">{t('signup.dateOfBirth')}</Label>
          <Input
            id="signup-dob"
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            max={maxBirthDate}
            required
            disabled={emailLoading}
            autoComplete="bday"
          />
          <p className="text-pretty text-xs text-muted-foreground">{t('signup.ageHint')}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-password">{t('signup.password')}</Label>
          <Input
            id="signup-password"
            type="password"
            placeholder={t('signup.passwordPlaceholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            disabled={emailLoading}
            autoComplete="new-password"
          />
          <PasswordStrengthIndicator password={password} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-confirm-password">{t('signup.confirmPassword')}</Label>
          <Input
            id="signup-confirm-password"
            type="password"
            placeholder={t('signup.confirmPassword')}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            disabled={emailLoading}
            autoComplete="new-password"
          />
        </div>
        <div className="flex items-start gap-2">
          <Checkbox
            id="signup-terms"
            checked={acceptedTerms}
            onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
            disabled={emailLoading}
            className="mt-0.5"
          />
          <Label htmlFor="signup-terms" className="text-pretty text-sm font-normal leading-snug">
            {t('signup.termsLabel')}
          </Label>
        </div>
        <Button
          type="submit"
          className="gradient-warm w-full text-primary-foreground"
          disabled={emailLoading}
        >
          {emailLoading ? t('signup.submitting') : t('signup.submit')}
        </Button>
      </form>
      <p className="text-pretty text-center text-sm text-muted-foreground">
        {t('signup.hasAccount')}{' '}
        <Link href={loginHref} className="font-medium text-primary hover:underline">
          {t('signup.loginLink')}
        </Link>
      </p>
    </div>
  );
}
