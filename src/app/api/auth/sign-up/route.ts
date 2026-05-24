import { NextResponse } from 'next/server';

import { setAuthCookies, toPublicSession } from '@/lib/server/auth-cookies';
import { rustFetch, type RustAuthSession } from '@/lib/server/rust-api';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      username?: string;
    };
    const session = await rustFetch<RustAuthSession>('/auth/sign-up', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const response = NextResponse.json(toPublicSession(session));
    setAuthCookies(response, session);
    return response;
  } catch (err) {
    const status =
      err && typeof err === 'object' && 'status' in err && typeof err.status === 'number'
        ? err.status
        : 502;
    const message =
      err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
        ? err.message
        : 'sign up failed';
    return NextResponse.json({ error: message }, { status });
  }
}
