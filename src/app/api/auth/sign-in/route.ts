import { NextResponse } from 'next/server';

import { setAuthCookies, toPublicSession } from '@/lib/server/auth-cookies';
import { authErrorResponse } from '@/lib/server/auth-error-response';
import { rustFetch, type RustAuthSession } from '@/lib/server/rust-api';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };
    const session = await rustFetch<RustAuthSession>('/auth/sign-in', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const response = NextResponse.json(toPublicSession(session));
    setAuthCookies(response, session);
    return response;
  } catch (err) {
    return authErrorResponse(err);
  }
}
