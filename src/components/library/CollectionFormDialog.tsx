"use client";

import { useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/hooks/useLanguage';
import {
  DEFAULT_LIBRARY_COLLECTION_ICON,
  LIBRARY_COLLECTION_ICONS,
  LIBRARY_DESCRIPTION_MAX_LENGTH,
  LIBRARY_ICON_LABEL_KEYS,
  LibraryCollectionIcon,
  type LibraryCollectionIconId,
} from '@/lib/libraryIcons';
import { cn } from '@/lib/utils';
import { Loader2, X } from 'lucide-react';

export type CollectionFormValues = {
  name: string;
  description: string;
  icon: LibraryCollectionIconId;
};

interface CollectionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initialValues?: Partial<CollectionFormValues>;
  submitting?: boolean;
  onSubmit: (values: CollectionFormValues) => Promise<void>;
}

export default function CollectionFormDialog({
  open,
  onOpenChange,
  mode,
  initialValues,
  submitting = false,
  onSubmit,
}: CollectionFormDialogProps) {
  const { t, tf } = useLanguage();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState<LibraryCollectionIconId>(DEFAULT_LIBRARY_COLLECTION_ICON);

  useEffect(() => {
    if (!open) return;
    setName(initialValues?.name ?? '');
    setDescription(initialValues?.description ?? '');
    setIcon(initialValues?.icon ?? DEFAULT_LIBRARY_COLLECTION_ICON);
  }, [open, initialValues?.name, initialValues?.description, initialValues?.icon]);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    await onSubmit({
      name: trimmedName,
      description: description.trim(),
      icon,
    });
  };

  const title =
    mode === 'create' ? t('library.createCollection') : t('library.editCollection');
  const descriptionRemaining = LIBRARY_DESCRIPTION_MAX_LENGTH - description.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="z-[120] bg-background/70 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-[50%] top-[50%] z-[120] grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg',
          )}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="sr-only">{title}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="collection-name">{t('library.collectionName')}</Label>
              <Input
                id="collection-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('library.collectionName')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="collection-description">{t('library.collectionDescription')}</Label>
              <Textarea
                id="collection-description"
                value={description}
                onChange={(e) => {
                  if (e.target.value.length <= LIBRARY_DESCRIPTION_MAX_LENGTH) {
                    setDescription(e.target.value);
                  }
                }}
                placeholder={t('library.collectionDescriptionPlaceholder')}
                rows={3}
              />
              <p className="text-xs text-muted-foreground text-right">
                {tf('library.descriptionRemaining', { n: descriptionRemaining })}
              </p>
            </div>

            <div className="space-y-2">
              <Label>{t('library.collectionIcon')}</Label>
              <div className="grid grid-cols-6 gap-2">
                {LIBRARY_COLLECTION_ICONS.map((iconId) => (
                  <button
                    key={iconId}
                    type="button"
                    title={t(LIBRARY_ICON_LABEL_KEYS[iconId])}
                    aria-label={t(LIBRARY_ICON_LABEL_KEYS[iconId])}
                    aria-pressed={icon === iconId}
                    onClick={() => setIcon(iconId)}
                    className={cn(
                      'flex h-10 w-full items-center justify-center rounded-lg border transition-colors',
                      icon === iconId
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:bg-accent',
                    )}
                  >
                    <LibraryCollectionIcon icon={iconId} className="h-5 w-5" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              {t('library.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting || !name.trim()}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('library.save')}
            </Button>
          </DialogFooter>

          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <X className="h-4 w-4" />
            <span className="sr-only">{t('common.close')}</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
