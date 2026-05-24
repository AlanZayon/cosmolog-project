import type { ApiErrorBody } from '@/lib/api/types';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Browser calls the Next.js BFF proxy (cookies carry auth). */
export function apiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return '/api/proxy';
  }
  const internal = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? '';
  return internal.replace(/\/$/, '');
}

export function isApiConfigured(): boolean {
  if (typeof window !== 'undefined') {
    return true;
  }
  return Boolean(process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL);
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const base = apiBaseUrl();
  if (!base) {
    throw new Error('API is not configured');
  }

  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${base}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiErrorBody;
    throw new ApiError(res.status, body.error ?? res.statusText);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

/** Auth BFF routes (same-origin, cookies). */
export async function authFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiErrorBody;
    throw new ApiError(res.status, body.error ?? res.statusText);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}
