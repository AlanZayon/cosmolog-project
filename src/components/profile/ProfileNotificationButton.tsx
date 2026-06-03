"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  Check,
  Globe,
  Info,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import NotificationLampIcon from '@/components/NotificationLampIcon';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/use-toast';
import {
  ApiError,
  cancelProfileSubscriptionByUsername,
  cancelUniverseSubscription,
  getNotificationSubscriptionStatus,
  getProfileNotificationSubscriptionByUsername,
  subscribeToProfileByUsername,
  subscribeToUniverse,
} from '@/lib/api';
import type { ApiNotificationSubscriptionStatus, ApiUniverse } from '@/lib/api/types';
import { cn } from '@/lib/utils';

type PendingSubscribe =
  | { scope: 'profile' }
  | { scope: 'universe'; universeId: string; universeTitle: string };

type ProfileNotificationButtonProps = {
  username: string;
  authorId: string;
  universes: ApiUniverse[];
  disabled?: boolean;
  className?: string;
};

function isSubscriptionActive(status: ApiNotificationSubscriptionStatus | null | undefined) {
  return Boolean(status?.subscribed && status.active);
}

type SubscriptionRowProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  active: boolean;
  disabled?: boolean;
  imageUrl?: string | null;
  onActivate: () => void;
  onDeactivate: () => void;
};

function SubscriptionRow({
  icon,
  title,
  description,
  active,
  disabled,
  imageUrl,
  onActivate,
  onDeactivate,
}: SubscriptionRowProps) {
  const { t } = useLanguage();

  return (
    <div
      className={cn(
        'flex gap-3 rounded-xl border p-3.5 transition-colors sm:p-4',
        active
          ? 'border-primary/30 bg-primary/5'
          : 'border-border bg-card hover:border-border/80 hover:bg-muted/30',
      )}
    >
      {imageUrl ? (
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
        <div
          className={cn(
            'flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border',
            active ? 'border-primary/20 bg-primary/10 text-primary' : 'border-border bg-muted text-muted-foreground',
          )}
        >
          {icon}
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium leading-snug text-foreground line-clamp-2">{title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
          </div>
          {active ? (
            <Badge variant="secondary" className="shrink-0 gap-1 border-primary/20 bg-primary/10 text-primary">
              <Check className="h-3 w-3" aria-hidden />
              {t('notifications.activeBadge')}
            </Badge>
          ) : null}
        </div>
        {active ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-fit px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={disabled}
            onClick={onDeactivate}
          >
            {t('notifications.deactivate')}
          </Button>
        ) : (
          <Button
            type="button"
            variant="default"
            size="sm"
            className="h-9 w-full touch-manipulation sm:w-fit"
            disabled={disabled}
            onClick={onActivate}
          >
            <NotificationLampIcon active size="sm" className="mr-0.5" />
            {t('notifications.activate')}
          </Button>
        )}
      </div>
    </div>
  );
}

function ConfirmStep({
  pending,
  submitting,
  onBack,
  onConfirm,
}: {
  pending: PendingSubscribe;
  submitting: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const { t, tf } = useLanguage();

  const title =
    pending.scope === 'universe'
      ? tf('notifications.activateUniverseTitle', { title: pending.universeTitle })
      : t('notifications.activateProfileTitle');

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={onBack}
        disabled={submitting}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t('notifications.back')}
      </button>

      <div className="flex flex-col items-center gap-4 text-center sm:items-start sm:text-left">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
          <NotificationLampIcon active size="lg" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-semibold leading-tight text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{t('notifications.confirmLead')}</p>
        </div>
      </div>

      <ul className="space-y-3 rounded-xl border border-border/80 bg-muted/25 p-4 text-sm">
        <li className="flex gap-3 text-muted-foreground">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span>{t('notifications.bulletNotify')}</span>
        </li>
        <li className="flex gap-3 text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>{t('notifications.bulletAutoOff')}</span>
        </li>
      </ul>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" disabled={submitting} onClick={onBack} className="touch-manipulation">
          {t('common.cancel')}
        </Button>
        <Button
          type="button"
          disabled={submitting}
          className="touch-manipulation gap-2"
          onClick={() => void onConfirm()}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <NotificationLampIcon active className="text-amber-200 fill-amber-200" />
          )}
          {t('notifications.confirm')}
        </Button>
      </div>
    </div>
  );
}

function NotificationPanelBody({
  username,
  universes,
  profileStatus,
  universeStatuses,
  loadingStatus,
  submitting,
  confirmStep,
  onOpenConfirm,
  onBackFromConfirm,
  onConfirm,
  onCancelProfile,
  onCancelUniverse,
}: {
  username: string;
  universes: ApiUniverse[];
  profileStatus: ApiNotificationSubscriptionStatus | null;
  universeStatuses: Record<string, ApiNotificationSubscriptionStatus>;
  loadingStatus: boolean;
  submitting: boolean;
  confirmStep: PendingSubscribe | null;
  onOpenConfirm: (action: PendingSubscribe) => void;
  onBackFromConfirm: () => void;
  onConfirm: () => void;
  onCancelProfile: () => void;
  onCancelUniverse: (universeId: string) => void;
}) {
  const { t, tf } = useLanguage();
  const profileActive = isSubscriptionActive(profileStatus);
  const busy = loadingStatus || submitting;

  if (confirmStep) {
    return (
      <ConfirmStep
        pending={confirmStep}
        submitting={submitting}
        onBack={onBackFromConfirm}
        onConfirm={onConfirm}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {loadingStatus ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('common.loading')}
        </div>
      ) : (
        <>
          <SubscriptionRow
            icon={<BookOpen className="h-6 w-6" aria-hidden />}
            title={t('notifications.subscribeAllStories')}
            description={tf('notifications.profileOptionDesc', { username })}
            active={profileActive}
            disabled={busy}
            onActivate={() => onOpenConfirm({ scope: 'profile' })}
            onDeactivate={onCancelProfile}
          />

          {universes.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('notifications.universeSection')}
              </p>
              <div className="space-y-2.5">
                {universes.map((universe) => {
                  const status = universeStatuses[universe.id];
                  const active = isSubscriptionActive(status);
                  return (
                    <SubscriptionRow
                      key={universe.id}
                      icon={<Globe className="h-6 w-6" aria-hidden />}
                      title={universe.title}
                      description={t('notifications.universeOptionDesc')}
                      active={active}
                      disabled={busy}
                      imageUrl={universe.cover_image_url}
                      onActivate={() =>
                        onOpenConfirm({
                          scope: 'universe',
                          universeId: universe.id,
                          universeTitle: universe.title,
                        })
                      }
                      onDeactivate={() => onCancelUniverse(universe.id)}
                    />
                  );
                })}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export default function ProfileNotificationButton({
  username,
  authorId,
  universes,
  disabled = false,
  className,
}: ProfileNotificationButtonProps) {
  const { t, tf } = useLanguage();
  const { toast } = useToast();

  const [profileStatus, setProfileStatus] = useState<ApiNotificationSubscriptionStatus | null>(null);
  const [universeStatuses, setUniverseStatuses] = useState<
    Record<string, ApiNotificationSubscriptionStatus>
  >({});
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [confirmStep, setConfirmStep] = useState<PendingSubscribe | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const profileActive = isSubscriptionActive(profileStatus);
  const anyUniverseActive = universes.some((u) =>
    isSubscriptionActive(universeStatuses[u.id]),
  );
  const hasAnyActive = profileActive || anyUniverseActive;

  const refreshStatuses = useCallback(async () => {
    if (disabled) return;
    setLoadingStatus(true);
    try {
      const profile = await getProfileNotificationSubscriptionByUsername(username);
      setProfileStatus(profile);

      if (universes.length === 0) {
        setUniverseStatuses({});
        return;
      }

      const entries = await Promise.all(
        universes.map(async (universe) => {
          const status = await getNotificationSubscriptionStatus({
            authorId,
            universeId: universe.id,
          });
          return [universe.id, status] as const;
        }),
      );
      setUniverseStatuses(Object.fromEntries(entries));
    } catch {
      setProfileStatus(null);
      setUniverseStatuses({});
    } finally {
      setLoadingStatus(false);
    }
  }, [authorId, disabled, universes, username]);

  useEffect(() => {
    void refreshStatuses();
  }, [refreshStatuses]);

  useEffect(() => {
    if (!panelOpen) {
      setConfirmStep(null);
    }
  }, [panelOpen]);

  const handlePanelOpenChange = (open: boolean) => {
    setPanelOpen(open);
    if (!open) setConfirmStep(null);
  };

  const handleConfirmSubscribe = async () => {
    if (!confirmStep) return;
    setSubmitting(true);
    try {
      if (confirmStep.scope === 'profile') {
        const status = await subscribeToProfileByUsername(username);
        setProfileStatus(status);
      } else {
        const status = await subscribeToUniverse(confirmStep.universeId);
        setUniverseStatuses((prev) => ({ ...prev, [confirmStep.universeId]: status }));
      }
      toast({ title: t('notifications.subscribed') });
      setConfirmStep(null);
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err instanceof ApiError ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelProfile = async () => {
    setSubmitting(true);
    try {
      await cancelProfileSubscriptionByUsername(username);
      await refreshStatuses();
      toast({ title: t('notifications.unsubscribed') });
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err instanceof ApiError ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelUniverse = async (universeId: string) => {
    setSubmitting(true);
    try {
      await cancelUniverseSubscription(universeId);
      await refreshStatuses();
      toast({ title: t('notifications.unsubscribed') });
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err instanceof ApiError ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const panelTitle = confirmStep
    ? t('notifications.confirmStepTitle')
    : t('notifications.panelTitle');

  const panelDescription = confirmStep
    ? undefined
    : tf('notifications.panelSubtitle', { username });

  const panelBody = (
    <NotificationPanelBody
      username={username}
      universes={universes}
      profileStatus={profileStatus}
      universeStatuses={universeStatuses}
      loadingStatus={loadingStatus}
      submitting={submitting}
      confirmStep={confirmStep}
      onOpenConfirm={setConfirmStep}
      onBackFromConfirm={() => setConfirmStep(null)}
      onConfirm={handleConfirmSubscribe}
      onCancelProfile={() => void handleCancelProfile()}
      onCancelUniverse={(id) => void handleCancelUniverse(id)}
    />
  );

  const trigger = (
    <Button
      type="button"
      variant={hasAnyActive ? 'default' : 'outline'}
      size="default"
      className={cn(
        'h-11 w-full touch-manipulation gap-2 shadow-sm sm:h-10 sm:w-auto',
        hasAnyActive && 'bg-primary text-primary-foreground hover:bg-primary/90',
        className,
      )}
      disabled={loadingStatus && !panelOpen}
      onClick={() => setPanelOpen(true)}
    >
      {loadingStatus && !panelOpen ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <NotificationLampIcon
          active={hasAnyActive}
          className={cn('shrink-0', hasAnyActive && 'text-amber-200 fill-amber-200 drop-shadow-[0_0_8px_rgba(253,224,71,0.5)]')}
        />
      )}
      <span className="font-medium">
        {hasAnyActive ? t('notifications.manage') : t('notifications.followCta')}
      </span>
    </Button>
  );

  if (disabled) {
    return null;
  }

  return (
    <>
      {trigger}

      <Dialog open={panelOpen} onOpenChange={handlePanelOpenChange}>
        <DialogContent
          className={cn(
            'gap-0 overflow-y-auto p-0',
            'fixed inset-x-0 bottom-0 top-auto max-h-[min(88vh,720px)] w-full max-w-none translate-x-0 translate-y-0 rounded-t-2xl border-b-0',
            'data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
            'sm:inset-x-auto sm:bottom-auto sm:left-[50%] sm:top-[50%] sm:max-h-[min(85vh,640px)] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:border',
          )}
        >
          <DialogHeader className="space-y-1 border-b border-border/80 px-5 py-5 text-left sm:px-6">
            <DialogTitle className="text-xl font-serif pr-8">{panelTitle}</DialogTitle>
            {panelDescription ? (
              <DialogDescription className="text-sm leading-relaxed">{panelDescription}</DialogDescription>
            ) : null}
          </DialogHeader>
          <div className="px-5 py-5 sm:px-6">{panelBody}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Shown when visitor is not logged in but profile has stories. */
export function ProfileNotificationLoginPrompt({ className }: { className?: string }) {
  const { t } = useLanguage();

  return (
    <Button
      variant="outline"
      size="default"
      className={cn('h-11 w-full touch-manipulation gap-2 shadow-sm sm:h-10 sm:w-auto', className)}
      asChild
    >
      <Link href="/login">
        <NotificationLampIcon active={false} className="shrink-0" />
        <span className="font-medium">{t('notifications.followCta')}</span>
      </Link>
    </Button>
  );
}
