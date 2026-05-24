import type { NextResponse } from 'next/server';

import type { RustAuthSession } from '@/lib/server/rust-api';

export const ACCESS_TOKEN_COOKIE = 'cosmolog_access_token';
export const REFRESH_TOKEN_COOKIE = 'cosmolog_refresh_token';

const isProduction = process.env.NODE_ENV === 'production';

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export function setAuthCookies(response: NextResponse, session: RustAuthSession): void {
  response.cookies.set(
    ACCESS_TOKEN_COOKIE,
    session.access_token,
    cookieOptions(session.expires_in),
  );
  response.cookies.set(
    REFRESH_TOKEN_COOKIE,
    session.refresh_token,
    cookieOptions(60 * 60 * 24 * 30),
  );
}

export function clearAuthCookies(response: NextResponse): void {
  response.cookies.set(ACCESS_TOKEN_COOKIE, '', { ...cookieOptions(0), maxAge: 0 });
  response.cookies.set(REFRESH_TOKEN_COOKIE, '', { ...cookieOptions(0), maxAge: 0 });
}

export function toPublicSession(session: RustAuthSession) {
  return {
    user: {
      id: session.user.id,
      email: session.user.email ?? null,
    },
    expires_at: Date.now() + session.expires_in * 1000,
  };
}
