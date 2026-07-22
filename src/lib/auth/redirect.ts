export function sanitizeRedirectPath(
  target: string | null | undefined,
  fallback = '/',
): string {
  if (target?.startsWith('/') && !target.startsWith('//')) {
    return target;
  }
  return fallback;
}

export function buildAuthHref(
  path: '/login' | '/signup',
  redirect?: string | null,
): string {
  const safe = sanitizeRedirectPath(redirect, '/');
  if (safe === '/') return path;
  return `${path}?redirect=${encodeURIComponent(safe)}`;
}
