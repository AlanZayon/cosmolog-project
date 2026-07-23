import { type NextRequest, NextResponse } from 'next/server';

import { publicRequestOrigin } from '@/lib/server/app-origin';
import { rustFetch } from '@/lib/server/rust-api';

/** Email confirmation link target: validates the token and redirects to login. */
export async function GET(request: NextRequest) {
  const origin = publicRequestOrigin(request);
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=invalid_token', origin));
  }

  try {
    await rustFetch('/auth/confirm-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
    return NextResponse.redirect(new URL('/login?confirmed=1', origin));
  } catch {
    return NextResponse.redirect(new URL('/login?error=invalid_token', origin));
  }
}
