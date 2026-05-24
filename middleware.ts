import { type NextRequest, NextResponse } from 'next/server';

const ACCESS_TOKEN_COOKIE = 'cosmolog_access_token';

const PROTECTED_PATTERNS = [
  /^\/profile\/?$/,
  /^\/create\/?$/,
  /^\/universes\/create\/?$/,
  /^\/universe\/[^/]+\/create-story\/?$/,
];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATTERNS.some((pattern) => pattern.test(pathname));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  if (request.cookies.has(ACCESS_TOKEN_COOKIE)) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.searchParams.set('redirect', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
