import { authFetch } from '@/lib/api/client';
import type { PublicSession } from '@/lib/auth/session';

export function signIn(email: string, password: string) {
  return authFetch<PublicSession>('/api/auth/sign-in', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function signUp(email: string, password: string, username: string) {
  return authFetch<PublicSession>('/api/auth/sign-up', {
    method: 'POST',
    body: JSON.stringify({ email, password, username }),
  });
}

export function fetchSession() {
  return authFetch<PublicSession>('/api/auth/session');
}

export function signOutSession() {
  return authFetch<{ ok: boolean }>('/api/auth/sign-out', { method: 'POST' });
}
