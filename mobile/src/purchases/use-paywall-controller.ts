import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking } from 'react-native';
import type { PurchasesOffering } from 'react-native-purchases';

import type { PaywallPreview } from '@/components/paywall/dev-preview';
import { LEGAL_URLS } from '@/constants/legal';
import { useWorkoutStore } from '@/store/workout-store';

import type { ProPeriod } from './entitlement';
import {
  ctaTitle,
  defaultOfferId,
  freeTrial,
  introLine,
  termsText,
  type FreeTrial,
  type ProOffer,
} from './offers';
import { settlePaywall, type PaywallOutcome, type ProReason } from './pro-gate';
import {
  PURCHASE_COPY,
  loadProOffers,
  purchaseOffer,
  restorePurchases,
  trackPaywallImpression,
} from './purchases';
import { track } from '@/analytics/analytics';

export type PaywallLoadState =
  | { status: 'loading' }
  | { status: 'ready'; offering: PurchasesOffering; offers: ProOffer[] }
  | { status: 'offline' | 'unavailable' };

export type PaywallBusy = 'purchase' | 'restore' | null;

/** Pro turned on from this paywall. The modal stays open on this until Continue. */
export type PaywallSuccess = {
  /** A purchase here, or a restore from this paywall's footer. */
  kind: 'purchased' | 'restored';
  /** When the free trial this purchase started ends. Null without a trial (and for restores). */
  trialEndsAt: Date | null;
};

export type PaywallController = {
  reason: ProReason;
  load: PaywallLoadState;
  /** Empty until offers load. Only real, priced store products. */
  offers: ProOffer[];
  selected: ProOffer | null;
  select: (id: ProPeriod) => void;
  busy: PaywallBusy;
  /** Inline status (errors, "not active yet"). Null when there is nothing to say. */
  message: string | null;
  /** Copy for the load failure state, or null. */
  loadError: string | null;
  canPurchase: boolean;
  ctaTitle: string;
  /** Intro/trial line for the selected offer, only when eligible. */
  introLine: string | null;
  /** The selected offer's eligible free trial, or null. */
  trial: FreeTrial | null;
  /** Auto-renewal disclosure for the selected offer. */
  termsText: string | null;
  /**
   * Set once a purchase or a restore here turns Pro on. The paywall shows its success
   * state and the gate stays open until `proceed` (or the modal goes away some other way).
   */
  success: PaywallSuccess | null;
  /** Success state's CTA: settle the gate as purchased/restored so the placement resumes. */
  proceed: () => void;
  purchase: () => void;
  restore: () => void;
  retry: () => void;
  close: () => void;
  openTerms: () => void;
  openPrivacy: () => void;
};

const LOAD_ERROR_COPY = {
  offline: "Couldn't load prices. Check your connection and try again.",
  unavailable: "Trim Pro isn't available right now. Please try again later.",
} as const;

function openLegal(url: string) {
  void WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url).catch(() => undefined));
}

export type PaywallControllerOptions = {
  /**
   * Development previews only: replaces the store load, purchase and restore. Impressions,
   * the one-time post-workout flag and the real entitlement are left alone, so a preview
   * never consumes or changes anything.
   */
  preview?: PaywallPreview;
};

/**
 * The end of the free trial `offer` starts at `from`, from the store's intro period (the
 * same offer the paywall's timeline described). Null when the offer has no eligible trial.
 */
export function trialEndDate(offer: ProOffer, from: Date): Date | null {
  const intro = offer.intro;
  if (!intro?.isFreeTrial) {
    return null;
  }
  const count = intro.periodNumberOfUnits * Math.max(1, intro.cycles);
  if (count <= 0) {
    return null;
  }
  const end = new Date(from.getTime());
  switch (intro.periodUnit.toUpperCase()) {
    case 'DAY':
      end.setDate(end.getDate() + count);
      return end;
    case 'WEEK':
      end.setDate(end.getDate() + count * 7);
      return end;
    case 'MONTH':
      end.setMonth(end.getMonth() + count);
      return end;
    case 'YEAR':
      end.setFullYear(end.getFullYear() + count);
      return end;
    default:
      return null;
  }
}

/**
 * The paywall state machine: load offers for the placement (with intro eligibility),
 * select, purchase, restore, track the impression, mark the post-workout offer shown,
 * and settle the gate exactly once on every exit. Views only render what this returns.
 */
export function usePaywallController(
  reason: ProReason,
  session: string | undefined,
  options?: PaywallControllerOptions,
): PaywallController {
  /** Pass a stable (module-level) preview; a new one per render reloads offers. */
  const preview = options?.preview;
  const isPreview = preview != null;
  const router = useRouter();
  const { isPro, applyEntitlement, markPaywallShown } = useWorkoutStore();
  const [load, setLoad] = useState<PaywallLoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState<ProPeriod | null>(null);
  const [busy, setBusy] = useState<PaywallBusy>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<PaywallSuccess | null>(null);
  /** The store took the money but the entitlement wasn't active yet (`notActiveYet`). */
  const [pendingSuccess, setPendingSuccess] = useState<PaywallSuccess | null>(null);
  const closingRef = useRef(false);
  const impressionRef = useRef(false);
  // A purchase that went through before Pro was active celebrates once the entitlement lands.
  const shownSuccess = success ?? (isPro ? pendingSuccess : null);
  const successRef = useRef<PaywallSuccess | null>(null);
  useEffect(() => {
    successRef.current = shownSuccess;
  }, [shownSuccess]);

  const finish = useCallback(
    (outcome: PaywallOutcome) => {
      if (closingRef.current) {
        return;
      }
      closingRef.current = true;
      // Navigate first so a caller that resumes (e.g. pushes the new plan) lands above, not under, the paywall.
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
      settlePaywall(session, outcome);
    },
    [router, session],
  );

  // Unmount without a close path (hardware back, a swipe, parent dismissed): settle as
  // dismissed, or as purchased/restored once the success state is up, so a paid gate always
  // resumes. A no-op when this session already settled. Deferred so a StrictMode remount
  // doesn't count.
  const mountedRef = useRef(false);
  useEffect(() => {
    const mounted = mountedRef;
    const won = successRef;
    mounted.current = true;
    return () => {
      mounted.current = false;
      setTimeout(() => {
        if (!mounted.current) {
          settlePaywall(session, won.current?.kind ?? 'dismissed');
        }
      }, 0);
    };
  }, [session]);

  useEffect(() => {
    let cancelled = false;
    void (preview?.loadOffers ?? loadProOffers)(reason).then((result) => {
      if (cancelled) {
        return;
      }
      if (result.status === 'ok') {
        setLoad({ status: 'ready', offering: result.offering, offers: result.offers });
        setSelectedId((current) =>
          current && result.offers.some((offer) => offer.id === current)
            ? current
            : defaultOfferId(result.offers),
        );
        // Development preview of the success state (`?mock=success|success-notrial|restored`).
        if (preview?.opensOn) {
          const offer = result.offers.find((item) => item.id === defaultOfferId(result.offers));
          setSuccess({
            kind: preview.opensOn,
            trialEndsAt:
              preview.opensOn === 'purchased' && offer ? trialEndDate(offer, new Date()) : null,
          });
        }
      } else {
        setLoad({ status: result.status });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [reason, attempt, preview]);

  // Offers are on screen: count the impression and consume the one-time post-workout offer.
  useEffect(() => {
    if (load.status !== 'ready' || impressionRef.current || isPreview) {
      return;
    }
    impressionRef.current = true;
    trackPaywallImpression(reason, load.offering);
    markPaywallShown(reason);
  }, [load, reason, markPaywallShown, isPreview]);

  // Pro turned on from outside while open (Ask to Buy approved, another device, entitlement
  // sync): resume the gate quietly. Not while a purchase or restore is in flight (the SDK's
  // listener can land first) and not once this paywall owns the moment with its success state.
  useEffect(() => {
    if (isPro && busy === null && shownSuccess === null && !isPreview) {
      finish('restored');
    }
  }, [isPro, busy, shownSuccess, isPreview, finish]);

  const offers = load.status === 'ready' ? load.offers : [];
  const selected = offers.find((offer) => offer.id === selectedId) ?? null;

  const purchase = useCallback(() => {
    if (!selected || busy || shownSuccess || closingRef.current) {
      return;
    }
    setBusy('purchase');
    setMessage(null);
    if (!isPreview) {
      track('purchase_started', { reason, package: selected.id });
    }
    // The trial the buyer just agreed to, dated from now: the store starts it on purchase.
    const won: PaywallSuccess = { kind: 'purchased', trialEndsAt: trialEndDate(selected, new Date()) };
    void (preview?.purchase ?? purchaseOffer)(selected).then((result) => {
      if (!isPreview) {
        track('purchase_finished', { reason, package: selected.id, outcome: result.kind });
      }
      if (result.kind === 'success') {
        if (!isPreview) {
          applyEntitlement(result.entitlement);
        }
        // Same batch as the entitlement, so the outside-change effect never sees Pro without it.
        if (result.entitlement.status === 'pro') {
          setSuccess(won);
        } else {
          setPendingSuccess(won);
          setMessage(PURCHASE_COPY.notActiveYet);
        }
      } else if (result.kind === 'pending') {
        Alert.alert(PURCHASE_COPY.pendingTitle, PURCHASE_COPY.pendingBody, [
          { text: 'OK', onPress: () => finish('dismissed') },
        ]);
      } else if (result.kind === 'error') {
        setMessage(result.message);
      }
      setBusy(null);
    });
  }, [selected, busy, shownSuccess, isPreview, preview, applyEntitlement, finish, reason]);

  const restore = useCallback(() => {
    if (busy || shownSuccess || closingRef.current) {
      return;
    }
    setBusy('restore');
    setMessage(null);
    void (preview?.restore ?? restorePurchases)().then((result) => {
      if (!isPreview) {
        track('restore_finished', { outcome: result.kind });
      }
      setBusy(null);
      if (result.kind === 'restored') {
        if (!isPreview) {
          applyEntitlement(result.entitlement);
        }
        // Restore after "not active yet" is still this purchase landing, not a welcome back.
        setSuccess(pendingSuccess ?? { kind: 'restored', trialEndsAt: null });
      } else if (result.kind === 'none') {
        applyEntitlement(result.entitlement);
        Alert.alert(PURCHASE_COPY.noneTitle, PURCHASE_COPY.noneBody);
      } else {
        setMessage(result.message);
      }
    });
  }, [busy, shownSuccess, pendingSuccess, isPreview, preview, applyEntitlement]);

  const proceed = useCallback(() => {
    if (shownSuccess) {
      finish(shownSuccess.kind);
    }
  }, [shownSuccess, finish]);

  const retry = useCallback(() => {
    if (load.status === 'loading') {
      return;
    }
    setLoad({ status: 'loading' });
    setMessage(null);
    setAttempt((value) => value + 1);
  }, [load.status]);

  const close = useCallback(() => {
    if (busy) {
      return;
    }
    if (shownSuccess) {
      finish(shownSuccess.kind);
      return;
    }
    finish(load.status === 'offline' || load.status === 'unavailable' ? 'unavailable' : 'dismissed');
  }, [busy, shownSuccess, load.status, finish]);

  return {
    reason,
    load,
    offers,
    selected,
    select: setSelectedId,
    busy,
    message,
    loadError:
      load.status === 'offline' || load.status === 'unavailable' ? LOAD_ERROR_COPY[load.status] : null,
    canPurchase: selected != null && busy === null && shownSuccess === null,
    ctaTitle: ctaTitle(selected),
    introLine: selected ? introLine(selected) : null,
    trial: freeTrial(selected),
    termsText: selected ? termsText(selected) : null,
    success: shownSuccess,
    proceed,
    purchase,
    restore,
    retry,
    close,
    openTerms: () => openLegal(LEGAL_URLS.termsOfUse),
    openPrivacy: () => openLegal(LEGAL_URLS.privacyPolicy),
  };
}
