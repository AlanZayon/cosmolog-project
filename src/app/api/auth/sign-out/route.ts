import { type NextRequest, NextResponse } from 'next/server';

import { REFRESH_TOKEN_COOKIE, clearAuthCookies } from '@/lib/server/auth-cookies';
import { rustFetch } from '@/lib/server/rust-api';

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (refreshToken) {
    // Best-effort server-side revocation; cookies are cleared regardless.
    try {
      await rustFetch('/auth/sign-out', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch {
      // Ignore: token may already be expired/revoked.
    }
  }

  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  return response;
}
