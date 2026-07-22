import { NextResponse } from 'next/server';

import { setAuthCookies, toPublicSession } from '@/lib/server/auth-cookies';
import { authErrorResponse } from '@/lib/server/auth-error-response';
import { rustFetch, type RustAuthSession } from '@/lib/server/rust-api';

/** Completes a password reset and signs the user in. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token?: string; password?: string };
    const session = await rustFetch<RustAuthSession>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        token: body.token ?? '',
        password: body.password ?? '',
      }),
    });
    const response = NextResponse.json(toPublicSession(session));
    setAuthCookies(response, session);
    return response;
  } catch (err) {
    return authErrorResponse(err);
  }
}
