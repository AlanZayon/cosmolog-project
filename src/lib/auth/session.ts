export type ApiSessionUser = {
  id: string;
  email?: string | null;
};

export type ApiSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: ApiSessionUser;
  expires_at: number;
};

const STORAGE_KEY = 'cosmolog_session';

export function loadSession(): ApiSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ApiSession;
    if (!parsed.access_token || !parsed.user?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: ApiSession | null): void {
  if (typeof window === 'undefined') return;
  if (!session) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function sessionWithExpiry(data: Omit<ApiSession, 'expires_at'>): ApiSession {
  return {
    ...data,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

export function isSessionExpired(session: ApiSession, skewMs = 60_000): boolean {
  return Date.now() >= session.expires_at - skewMs;
}
