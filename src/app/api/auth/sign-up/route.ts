import { NextResponse } from 'next/server';

import { setAuthCookies, toPublicSession } from '@/lib/server/auth-cookies';
import { authErrorResponse } from '@/lib/server/auth-error-response';
import { rustFetch, type RustSignUpResponse } from '@/lib/server/rust-api';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      username?: string;
      full_name?: string;
      date_of_birth?: string;
    };
    const result = await rustFetch<RustSignUpResponse>('/auth/sign-up', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (result.status === 'pending_confirmation') {
      return NextResponse.json({
        pending_email_confirmation: true,
        user: {
          id: result.user_id,
          email: result.email ?? null,
        },
      });
    }

    const response = NextResponse.json(toPublicSession(result));
    setAuthCookies(response, result);
    return response;
  } catch (err) {
    return authErrorResponse(err);
  }
}
