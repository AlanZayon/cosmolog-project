import { apiFetch } from '@/lib/api/client';
import type { ApiSession } from '@/lib/auth/session';

export function signIn(email: string, password: string) {
  return apiFetch<ApiSession>('/auth/sign-in', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function signUp(email: string, password: string, username: string) {
  return apiFetch<ApiSession>('/auth/sign-up', {
    method: 'POST',
    body: JSON.stringify({ email, password, username }),
  });
}

export function refreshSession(refresh_token: string) {
  return apiFetch<ApiSession>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token }),
  });
}

export function getAuthMe(token: string) {
  return apiFetch<{ user_id: string; role: string; email?: string | null }>('/auth/me', {
    token,
  });
}
