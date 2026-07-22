'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

type AuthModalContextValue = {
  closeAuthModal: (destination?: string) => void;
};

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  const closeAuthModal = useCallback(
    (destination = '/') => {
      setOpen(false);
      router.back();

      queueMicrotask(() => {
        if (destination !== '/') {
          router.replace(destination);
        }
        router.refresh();
      });
    },
    [router],
  );

  const value = useMemo(() => ({ closeAuthModal }), [closeAuthModal]);

  return (
    <AuthModalContext.Provider value={value}>
      <AuthModalOpenContext.Provider value={open}>{children}</AuthModalOpenContext.Provider>
    </AuthModalContext.Provider>
  );
}

const AuthModalOpenContext = createContext(true);

export function useAuthModalOpen() {
  return useContext(AuthModalOpenContext);
}

export function useAuthModal() {
  return useContext(AuthModalContext);
}

export function useAuthModalCloseHandler() {
  const router = useRouter();
  const authModal = useAuthModal();

  return useCallback(
    (destination = '/') => {
      if (authModal) {
        authModal.closeAuthModal(destination);
        return;
      }

      if (destination === '/') {
        router.replace('/');
      } else {
        router.replace(destination);
      }
      router.refresh();
    },
    [authModal, router],
  );
}
