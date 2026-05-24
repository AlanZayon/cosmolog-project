import { NextResponse } from 'next/server';

import {
  clearAuthCookies,
  setAuthCookies,
  toPublicSession,
} from '@/lib/server/auth-cookies';
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

function authErrorResponse(err: unknown) {
  const status =
    err && typeof err === 'object' && 'status' in err && typeof err.status === 'number'
      ? err.status
      : 502;
  const message =
    err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
      ? err.message
      : 'authentication failed';
  if (status === 401) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const response = NextResponse.json({ error: message }, { status });
  if (status === 401) {
    clearAuthCookies(response);
  }
  return response;
}
