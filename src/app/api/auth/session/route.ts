import { type NextRequest, NextResponse } from 'next/server';

import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  clearAuthCookies,
  setAuthCookies,
  toPublicSession,
} from '@/lib/server/auth-cookies';
import { rustFetch, type RustAuthSession, type RustMeResponse } from '@/lib/server/rust-api';

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!accessToken && !refreshToken) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (accessToken) {
    try {
      const me = await rustFetch<RustMeResponse>('/auth/me', { accessToken });
      return NextResponse.json({
        user: {
          id: me.user_id,
          email: me.email ?? null,
        },
        expires_at: null,
      });
    } catch {
      // try refresh below
    }
  }

  if (!refreshToken) {
    const response = NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    clearAuthCookies(response);
    return response;
  }

  try {
    const session = await rustFetch<RustAuthSession>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const response = NextResponse.json(toPublicSession(session));
    setAuthCookies(response, session);
    return response;
  } catch {
    const response = NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    clearAuthCookies(response);
    return response;
  }
}
