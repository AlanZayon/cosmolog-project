import { type NextRequest, NextResponse } from 'next/server';

import { ACCESS_TOKEN_COOKIE } from '@/lib/server/auth-cookies';
import { internalApiBaseUrl } from '@/lib/server/rust-api';

function encodePathSegment(segment: string): string {
  try {
    return encodeURIComponent(decodeURIComponent(segment));
  } catch {
    return encodeURIComponent(segment);
  }
}

export async function proxyToRust(
  request: NextRequest,
  pathSegments: string[],
): Promise<NextResponse> {
  const base = internalApiBaseUrl();
  const path = pathSegments.map(encodePathSegment).join('/');
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
    if (upstreamContentType.includes('text/event-stream')) {
      responseHeaders.set('cache-control', 'no-cache, no-transform');
      responseHeaders.set('connection', 'keep-alive');
      responseHeaders.set('x-accel-buffering', 'no');
    }
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
