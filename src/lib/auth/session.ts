export type ApiSessionUser = {
  id: string;
  email?: string | null;
};

/** Client-visible session — tokens live in httpOnly cookies only. */
export type PublicSession = {
  user: ApiSessionUser;
  expires_at: number | null;
};

const LEGACY_STORAGE_KEY = 'cosmolog_session';

/** Remove legacy localStorage tokens from older builds. */
export function clearLegacySessionStorage(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}
