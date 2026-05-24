import { type NextRequest, NextResponse } from 'next/server';

import { ACCESS_TOKEN_COOKIE } from '@/lib/server/auth-cookies';
import { internalApiBaseUrl } from '@/lib/server/rust-api';

export async function proxyToRust(
  request: NextRequest,
  pathSegments: string[],
): Promise<NextResponse> {
  const base = internalApiBaseUrl();
  const path = pathSegments.map(encodeURIComponent).join('/');
  const url = `${base}/${path}${request.nextUrl.search}`;

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const accept = request.headers.get('accept');
  if (accept) headers.set('accept', accept);
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);

  const hasBody = !['GET', 'HEAD'].includes(request.method);
  const upstream = await fetch(url, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    duplex: hasBody ? 'half' : undefined,
  } as RequestInit);

  const responseHeaders = new Headers();
  const upstreamContentType = upstream.headers.get('content-type');
  if (upstreamContentType) {
    responseHeaders.set('content-type', upstreamContentType);
  }
  const requestId = upstream.headers.get('x-request-id');
  if (requestId) {
    responseHeaders.set('x-request-id', requestId);
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
