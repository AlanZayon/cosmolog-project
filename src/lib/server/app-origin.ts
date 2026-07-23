import { type NextRequest } from 'next/server';

/**
 * Public origin for redirects/OAuth callbacks.
 * Next bound to 0.0.0.0 (Docker) reports an unusable origin; normalize to localhost.
 */
export function publicRequestOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const host = forwardedHost ?? request.headers.get('host');

  if (host && !host.startsWith('0.0.0.0')) {
    const proto =
      forwardedProto
      ?? (request.nextUrl.protocol === 'https:' ? 'https' : 'http');
    return `${proto}://${host}`;
  }

  const configured = process.env.APP_PUBLIC_URL?.trim().replace(/\/$/, '');
  if (configured) {
    return configured;
  }

  const port = request.nextUrl.port || '3000';
  return `http://localhost:${port}`;
}
