'use client';

import { useAuthModalCloseHandler } from '@/components/auth/AuthModalContext';

export function useAuthNavigation() {
  const closeAuth = useAuthModalCloseHandler();

  return { completeAuth: closeAuth };
}
