'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AuthModalProvider,
  useAuthModal,
  useAuthModalOpen,
} from '@/components/auth/AuthModalContext';

type AuthDialogProps = {
  title: string;
  description: string;
  children: React.ReactNode;
  wide?: boolean;
};

function AuthDialogInner({ title, description, children, wide = false }: AuthDialogProps) {
  const authModal = useAuthModal();
  const open = useAuthModalOpen();

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) authModal?.closeAuthModal('/');
      }}
    >
      <DialogContent
        className={
          wide
            ? 'max-h-[90dvh] w-[calc(100%-2rem)] max-w-md gap-0 overflow-y-auto p-0 sm:rounded-xl'
            : 'max-h-[90dvh] w-[calc(100%-2rem)] max-w-sm gap-0 overflow-y-auto p-0 sm:rounded-xl'
        }
      >
        <DialogHeader className="space-y-1 px-6 pb-2 pt-6 text-center">
          <DialogTitle className="font-serif text-xl">{title}</DialogTitle>
          <DialogDescription className="text-pretty text-sm">{description}</DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-6">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

export function AuthDialog(props: AuthDialogProps) {
  return (
    <AuthModalProvider>
      <AuthDialogInner {...props} />
    </AuthModalProvider>
  );
}
