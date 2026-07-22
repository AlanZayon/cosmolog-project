import { authFetch } from '@/lib/api/client';
import type { PublicSession } from '@/lib/auth/session';

export type PendingSignUp = {
  pending_email_confirmation: true;
  user: {
    id: string;
    email: string | null;
  };
};

export type SignUpResult = PublicSession | PendingSignUp;

export function isPendingSignUp(result: SignUpResult): result is PendingSignUp {
  return 'pending_email_confirmation' in result && result.pending_email_confirmation === true;
}

export function signIn(email: string, password: string) {
  return authFetch<PublicSession>('/api/auth/sign-in', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export type SignUpPayload = {
  email: string;
  password: string;
  fullName: string;
  dateOfBirth: string;
};

export function signUp(payload: SignUpPayload) {
  return authFetch<SignUpResult>('/api/auth/sign-up', {
    method: 'POST',
    body: JSON.stringify({
      email: payload.email,
      password: payload.password,
      full_name: payload.fullName,
      date_of_birth: payload.dateOfBirth,
    }),
  });
}

export function fetchSession() {
  return authFetch<PublicSession>('/api/auth/session');
}

export function signOutSession() {
  return authFetch<{ ok: boolean }>('/api/auth/sign-out', { method: 'POST' });
}

export function requestPasswordReset(email: string) {
  return authFetch<{ ok: boolean }>('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

/** Completes a password reset; the BFF also signs the user in. */
export function resetPassword(token: string, password: string) {
  return authFetch<PublicSession>('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
}
