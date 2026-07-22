import { NextResponse } from 'next/server';

import { clearAuthCookies } from '@/lib/server/auth-cookies';

export function authErrorResponse(err: unknown) {
  const status =
    err && typeof err === 'object' && 'status' in err && typeof err.status === 'number'
      ? err.status
      : 502;
  const message =
    err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
      ? err.message
      : status >= 500
        ? 'service_unavailable'
        : 'unknown';

  const response = NextResponse.json({ error: message }, { status });
  if (status === 401) {
    clearAuthCookies(response);
  }
  return response;
}
