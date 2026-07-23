import { type NextRequest, NextResponse } from 'next/server';

import {
  OAUTH_CODE_VERIFIER_COOKIE,
  OAUTH_REDIRECT_COOKIE,
  OAUTH_STATE_COOKIE,
} from '@/lib/server/auth-cookies';
import { sanitizeRedirectPath } from '@/lib/auth/redirect';
import {
  buildGoogleAuthorizeUrl,
  generateOAuthState,
  generatePkcePair,
} from '@/lib/server/oauth';
import { publicRequestOrigin } from '@/lib/server/app-origin';

const OAUTH_COOKIE_MAX_AGE = 60 * 10;

export async function GET(request: NextRequest) {
  const origin = publicRequestOrigin(request);
  try {
    const redirect = sanitizeRedirectPath(request.nextUrl.searchParams.get('redirect'));
    const callbackUrl = new URL('/api/auth/google/callback', origin).toString();
    const { verifier, challenge } = generatePkcePair();
    const state = generateOAuthState();
    const authorizeUrl = buildGoogleAuthorizeUrl(callbackUrl, challenge, state);

    const response = NextResponse.redirect(authorizeUrl);
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: OAUTH_COOKIE_MAX_AGE,
    };
    response.cookies.set(OAUTH_CODE_VERIFIER_COOKIE, verifier, cookieOptions);
    response.cookies.set(OAUTH_REDIRECT_COOKIE, redirect, cookieOptions);
    response.cookies.set(OAUTH_STATE_COOKIE, state, cookieOptions);
    return response;
  } catch {
    return NextResponse.redirect(new URL('/login?error=oauth_start_failed', origin));
  }
}
