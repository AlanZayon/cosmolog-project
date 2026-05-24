/** Server-only Rust API base URL (never exposed to the browser). */
export function internalApiBaseUrl(): string {
  const raw =
    process.env.API_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://127.0.0.1:8080';
  return raw.replace(/\/$/, '');
}

export type RustAuthSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: {
    id: string;
    email?: string | null;
  };
};

export type RustMeResponse = {
  user_id: string;
  role: string;
  email?: string | null;
};

export async function rustFetch<T>(
  path: string,
  init: RequestInit & { accessToken?: string } = {},
): Promise<T> {
  const base = internalApiBaseUrl();
  const { accessToken, headers: initHeaders, ...rest } = init;
  const headers = new Headers(initHeaders);
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  if (rest.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${base}${path.startsWith('/') ? path : `/${path}`}`, {
    ...rest,
    headers,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new RustApiError(res.status, body.error ?? res.statusText);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export class RustApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'RustApiError';
    this.status = status;
  }
}
