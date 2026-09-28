import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { PurchasesOffering } from 'react-native-purchases';

import type { PaywallPreview } from '@/components/paywall/dev-preview';
import { showToast } from '@/components/toast';
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

export type PaywallMessage = { text: string; error: boolean };

export type PaywallController = {
  reason: ProReason;
  load: PaywallLoadState;
  /** Empty until offers load. Only real, priced store products. */
  offers: ProOffer[];
  selected: ProOffer | null;
  select: (id: ProPeriod) => void;
  busy: PaywallBusy;
  /** Inline status above the CTA (errors in red, "not active yet"). Null when there is nothing to say. */
  message: PaywallMessage | null;
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
 * The fullScreenModal's dismiss: the confirmation lands on the screen the buyer returns to,
 * the same beat `Plan created` waits (trim-ui §12 Buying).
 */
const PAYWALL_GONE_MS = 320;

/**
 * Pro just turned on from a paywall (trim-ui §12 Moments, first Pro purchase). The paywall is
 * already closing and the gate resuming; this confirms it with a toast once the App Store's
 * sheet and alert are gone (they make the app inactive) and the modal has left. A purchase
 * gets one success haptic on the frame the toast lands; a restore stays quiet.
 */
function confirmProOn(kind: 'purchased' | 'restored' | 'on') {
  const land = () =>
    setTimeout(() => {
      showToast({ title: kind === 'restored' ? PURCHASE_COPY.restored : PURCHASE_COPY.proOn });
      if (kind === 'purchased' && process.env.EXPO_OS === 'ios') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }, PAYWALL_GONE_MS);
  if (AppState.currentState === 'active') {
    land();
    return;
  }
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      subscription.remove();
      land();
    }
  });
}

/**
 * The paywall state machine: load offers for the placement (with intro eligibility),
 * select, purchase, restore, track the impression, mark the post-workout offer shown,
 * and settle the gate exactly once on every exit. Views only render what this returns.
 * A purchase or restore that turns Pro on closes the paywall at once, so the gated action
 * completes where the user was (trim-ui §12 rule 17: no "Welcome to Pro" screen).
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
  const [message, setMessage] = useState<PaywallMessage | null>(null);
  const [purchaseFailed, setPurchaseFailed] = useState(false);
  /** The store took the money but the entitlement wasn't active yet (`notActiveYet`). */
  const [paidNotActive, setPaidNotActive] = useState(false);
  const closingRef = useRef(false);
  const impressionRef = useRef(false);

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

  /** Pro is on: close back to where they were, resume the gate, then confirm. Once. */
  const unlock = useCallback(
    (kind: 'purchased' | 'restored' | 'on') => {
      if (closingRef.current) {
        return;
      }
      finish(kind === 'purchased' ? 'purchased' : 'restored');
      confirmProOn(kind);
    },
    [finish],
  );

  // Unmount without a close path (hardware back, a swipe, parent dismissed): settle as
  // dismissed. A no-op when this session already settled. Deferred so a StrictMode remount
  // doesn't count.
  const mountedRef = useRef(false);
  useEffect(() => {
    const mounted = mountedRef;
    mounted.current = true;
    return () => {
      mounted.current = false;
      setTimeout(() => {
        if (!mounted.current) {
          settlePaywall(session, 'dismissed');
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
  // sync, or a purchase that was "not active yet"): close and resume the gate. Not while a
  // purchase or restore is in flight: the SDK's listener can land first, and the purchase's
  // own result must win so it settles as purchased.
  useEffect(() => {
    if (isPro && busy === null && !isPreview) {
      unlock(paidNotActive ? 'purchased' : 'on');
    }
  }, [isPro, busy, isPreview, paidNotActive, unlock]);

  const offers = load.status === 'ready' ? load.offers : [];
  const selected = offers.find((offer) => offer.id === selectedId) ?? null;

  const purchase = useCallback(() => {
    if (!selected || busy || closingRef.current) {
      return;
    }
    setBusy('purchase');
    setMessage(null);
    setPurchaseFailed(false);
    if (!isPreview) {
      track('purchase_started', { reason, package: selected.id });
    }
    void (preview?.purchase ?? purchaseOffer)(selected).then((result) => {
      if (!isPreview) {
        track('purchase_finished', { reason, package: selected.id, outcome: result.kind });
      }
      if (result.kind === 'success') {
        if (!isPreview) {
          applyEntitlement(result.entitlement);
        }
        // Same batch as the entitlement, so the outside-change effect never sees Pro first.
        if (result.entitlement.status === 'pro') {
          unlock('purchased');
        } else {
          setPaidNotActive(true);
          setMessage({ text: PURCHASE_COPY.notActiveYet, error: false });
        }
      } else if (result.kind === 'pending') {
        Alert.alert(PURCHASE_COPY.pendingTitle, PURCHASE_COPY.pendingBody, [
          { text: 'OK', onPress: () => finish('dismissed') },
        ]);
      } else if (result.kind === 'error') {
        // Rule 18: one line saying what happened, and the CTA offers Try again.
        setMessage({ text: result.message, error: true });
        setPurchaseFailed(true);
      }
      setBusy(null);
    });
  }, [selected, busy, isPreview, preview, applyEntitlement, finish, unlock, reason]);

  const restore = useCallback(() => {
    if (busy || closingRef.current) {
      return;
    }
    setBusy('restore');
    setMessage(null);
    void (preview?.restore ?? restorePurchases)().then((result) => {
      if (!isPreview) {
        track('restore_finished', { outcome: result.kind });
      }
      if (result.kind === 'restored') {
        if (!isPreview) {
          applyEntitlement(result.entitlement);
        }
        // Restore after "not active yet" is still this purchase landing.
        unlock(paidNotActive ? 'purchased' : 'restored');
      } else if (result.kind === 'none') {
        if (!isPreview) {
          applyEntitlement(result.entitlement);
        }
        // Rule 19: finishes in place. The paywall hosts its own toast above the footer.
        showToast({ title: PURCHASE_COPY.none });
      } else {
        setMessage({ text: result.message, error: true });
      }
      setBusy(null);
    });
  }, [busy, paidNotActive, isPreview, preview, applyEntitlement, unlock]);

  const select = useCallback((id: ProPeriod) => {
    setSelectedId(id);
    setPurchaseFailed(false);
  }, []);

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
    finish(load.status === 'offline' || load.status === 'unavailable' ? 'unavailable' : 'dismissed');
  }, [busy, load.status, finish]);

  return {
    reason,
    load,
    offers,
    selected,
    select,
    busy,
    message,
    loadError:
      load.status === 'offline' || load.status === 'unavailable' ? LOAD_ERROR_COPY[load.status] : null,
    canPurchase: selected != null && busy === null,
    ctaTitle: purchaseFailed ? 'Try again' : ctaTitle(selected),
    introLine: selected ? introLine(selected) : null,
    trial: freeTrial(selected),
    termsText: selected ? termsText(selected) : null,
    purchase,
    restore,
    retry,
    close,
    openTerms: () => openLegal(LEGAL_URLS.termsOfUse),
    openPrivacy: () => openLegal(LEGAL_URLS.privacyPolicy),
  };
}
