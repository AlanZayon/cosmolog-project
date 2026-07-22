import { NextResponse } from 'next/server';

import { authErrorResponse } from '@/lib/server/auth-error-response';
import { rustFetch } from '@/lib/server/rust-api';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string };
    await rustFetch('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: body.email ?? '' }),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err);
  }
}
