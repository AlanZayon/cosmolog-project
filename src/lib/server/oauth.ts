import { createHash, randomBytes } from 'crypto';

const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

export function googleClientId(): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID is not configured');
  }
  return clientId;
}

export function generatePkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function generateOAuthState(): string {
  return randomBytes(24).toString('base64url');
}

/** Direct Google OAuth authorization URL (PKCE + state, no Supabase). */
export function buildGoogleAuthorizeUrl(
  callbackUrl: string,
  codeChallenge: string,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: googleClientId(),
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTHORIZE_URL}?${params.toString()}`;
}
