import { ApiError } from '@/lib/api/client';
import type { TranslationKey } from '@/i18n/translations';

type AuthContext = 'login' | 'signup';

const LOGIN_ERROR_CODES: Partial<Record<string, TranslationKey>> = {
  invalid_credentials: 'auth.errors.invalidCredentials',
  email_not_confirmed: 'auth.errors.emailNotConfirmed',
  password_reset_required: 'auth.errors.passwordResetRequired',
  invalid_token: 'auth.errors.invalidToken',
  rate_limited: 'auth.errors.rateLimited',
  service_unavailable: 'auth.errors.serviceUnavailable',
  network_error: 'auth.errors.networkError',
  unauthorized: 'auth.errors.invalidCredentials',
  auth_request_failed: 'auth.errors.requestFailed',
  unknown: 'auth.errors.unknown',
  oauth_start_failed: 'auth.errors.oauthStartFailed',
  oauth_invalid: 'auth.errors.oauthInvalid',
  oauth_exchange_failed: 'auth.errors.oauthExchangeFailed',
};

const SIGNUP_ERROR_CODES: Partial<Record<string, TranslationKey>> = {
  email_already_registered: 'auth.errors.emailAlreadyRegistered',
  invalid_email: 'auth.errors.invalidEmail',
  password_too_short: 'auth.errors.passwordTooShort',
  weak_password: 'auth.errors.weakPassword',
  signup_disabled: 'auth.errors.signupDisabled',
  rate_limited: 'auth.errors.rateLimited',
  service_unavailable: 'auth.errors.serviceUnavailable',
  network_error: 'auth.errors.networkError',
  auth_request_failed: 'auth.errors.requestFailed',
  unknown: 'auth.errors.unknown',
};

const OAUTH_ERROR_CODES = new Set([
  'oauth_start_failed',
  'oauth_invalid',
  'oauth_exchange_failed',
]);

function mapByStatus(status: number, context: AuthContext): TranslationKey {
  if (status === 401) {
    return context === 'login'
      ? 'auth.errors.invalidCredentials'
      : 'auth.errors.requestFailed';
  }
  if (status === 409) return 'auth.errors.emailAlreadyRegistered';
  if (status === 429) return 'auth.errors.rateLimited';
  if (status >= 500) return 'auth.errors.serviceUnavailable';
  return 'auth.errors.requestFailed';
}

function mapByMessagePattern(raw: string, context: AuthContext): TranslationKey | null {
  const lower = raw.toLowerCase();

  if (
    lower.includes('invalid login') ||
    lower.includes('invalid credentials') ||
    lower.includes('invalid grant') ||
    lower.includes('invalid email or password')
  ) {
    return 'auth.errors.invalidCredentials';
  }

  if (lower.includes('email not confirmed')) {
    return 'auth.errors.emailNotConfirmed';
  }

  if (
    lower.includes('already registered') ||
    lower.includes('already been registered') ||
    lower.includes('already exists') ||
    lower.includes('user already exists') ||
    lower.includes('email address already') ||
    lower.includes('email already') ||
    lower.includes('email_exists') ||
    lower.includes('user_already_exists') ||
    lower === 'email_already_registered'
  ) {
    return 'auth.errors.emailAlreadyRegistered';
  }

  if (
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('only request this after')
  ) {
    return 'auth.errors.rateLimited';
  }

  if (lower.includes('unable to validate email') || lower.includes('invalid email')) {
    return 'auth.errors.invalidEmail';
  }

  if (
    lower.includes('password should be at least') ||
    lower.includes('password is too short') ||
    lower.includes('minimum password length')
  ) {
    return 'auth.errors.passwordTooShort';
  }

  if (lower.includes('weak password') || lower.includes('password is too weak')) {
    return 'auth.errors.weakPassword';
  }

  if (lower.includes('signup is disabled') || lower.includes('signups not allowed')) {
    return 'auth.errors.signupDisabled';
  }

  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'auth.errors.networkError';
  }

  if (context === 'login' && lower === 'unauthorized') {
    return 'auth.errors.invalidCredentials';
  }

  return null;
}

export function resolveAuthErrorMessage(
  err: unknown,
  context: AuthContext,
  t: (key: TranslationKey) => string,
): string {
  const codeMap = context === 'login' ? LOGIN_ERROR_CODES : SIGNUP_ERROR_CODES;

  if (err instanceof ApiError) {
    const code = err.message.trim().toLowerCase();
    const byCode = codeMap[code] ?? (OAUTH_ERROR_CODES.has(code) ? LOGIN_ERROR_CODES[code] : undefined);
    if (byCode) return t(byCode);

    const byPattern = mapByMessagePattern(err.message, context);
    if (byPattern) return t(byPattern);

    return t(mapByStatus(err.status, context));
  }

  if (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) {
    return t('auth.errors.networkError');
  }

  return t('auth.errors.unknown');
}

export function resolveOAuthUrlError(code: string | null, t: (key: TranslationKey) => string): string | null {
  if (!code) return null;
  const normalized = code.trim().toLowerCase();
  const key = LOGIN_ERROR_CODES[normalized];
  if (key) return t(key);
  const byPattern = mapByMessagePattern(code, 'login');
  if (byPattern) return t(byPattern);
  return t('auth.errors.oauthFailed');
}
