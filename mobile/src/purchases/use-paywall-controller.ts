import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking } from 'react-native';
import type { PurchasesOffering } from 'react-native-purchases';

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
  type OffersResult,
} from './purchases';
import { track } from '@/analytics/analytics';

export type PaywallLoadState =
  | { status: 'loading' }
  | { status: 'ready'; offering: PurchasesOffering; offers: ProOffer[] }
  | { status: 'offline' | 'unavailable' };

export type PaywallBusy = 'purchase' | 'restore' | null;

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
   * Development previews only: replaces the store load. Impressions and the
   * one-time post-workout flag are left alone so a preview never consumes them.
   */
  loadOffers?: (reason: ProReason) => Promise<OffersResult>;
};

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
  /** Pass a stable (module-level) function; a new one per render reloads offers. */
  const previewLoad = options?.loadOffers;
  const isPreview = previewLoad != null;
  const router = useRouter();
  const { isPro, applyEntitlement, markPaywallShown } = useWorkoutStore();
  const [load, setLoad] = useState<PaywallLoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState<ProPeriod | null>(null);
  const [busy, setBusy] = useState<PaywallBusy>(null);
  const [message, setMessage] = useState<string | null>(null);
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

  // Unmount without a close path (hardware back, parent dismissed): settle as dismissed.
  // A no-op when this session already settled. Deferred so a StrictMode remount doesn't count.
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
    void (previewLoad ?? loadProOffers)(reason).then((result) => {
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
  }, [reason, attempt, previewLoad]);

  // Offers are on screen: count the impression and consume the one-time post-workout offer.
  useEffect(() => {
    if (load.status !== 'ready' || impressionRef.current || isPreview) {
      return;
    }
    impressionRef.current = true;
    trackPaywallImpression(reason, load.offering);
    markPaywallShown(reason);
  }, [load, reason, markPaywallShown, isPreview]);

  // Pro turned on while open (Ask to Buy approved, another device, entitlement sync): resume the gate.
  useEffect(() => {
    if (isPro && busy === null) {
      finish('restored');
    }
  }, [isPro, busy, finish]);

  const offers = load.status === 'ready' ? load.offers : [];
  const selected = offers.find((offer) => offer.id === selectedId) ?? null;

  const purchase = useCallback(() => {
    if (!selected || busy || closingRef.current) {
      return;
    }
    setBusy('purchase');
    setMessage(null);
    track('purchase_started', { reason, package: selected.id });
    void purchaseOffer(selected).then((result) => {
      track('purchase_finished', { reason, package: selected.id, outcome: result.kind });
      if (result.kind === 'success') {
        applyEntitlement(result.entitlement);
        if (result.entitlement.status === 'pro') {
          finish('purchased');
          return;
        }
        setMessage(PURCHASE_COPY.notActiveYet);
      } else if (result.kind === 'pending') {
        Alert.alert(PURCHASE_COPY.pendingTitle, PURCHASE_COPY.pendingBody, [
          { text: 'OK', onPress: () => finish('dismissed') },
        ]);
      } else if (result.kind === 'error') {
        setMessage(result.message);
      }
      setBusy(null);
    });
  }, [selected, busy, applyEntitlement, finish, reason]);

  const restore = useCallback(() => {
    if (busy || closingRef.current) {
      return;
    }
    setBusy('restore');
    setMessage(null);
    void restorePurchases().then((result) => {
      track('restore_finished', { outcome: result.kind });
      if (result.kind === 'restored') {
        applyEntitlement(result.entitlement);
        finish('restored');
        return;
      }
      setBusy(null);
      if (result.kind === 'none') {
        applyEntitlement(result.entitlement);
        Alert.alert(PURCHASE_COPY.noneTitle, PURCHASE_COPY.noneBody);
      } else {
        setMessage(result.message);
      }
    });
  }, [busy, applyEntitlement, finish]);

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
    select: setSelectedId,
    busy,
    message,
    loadError:
      load.status === 'offline' || load.status === 'unavailable' ? LOAD_ERROR_COPY[load.status] : null,
    canPurchase: selected != null && busy === null,
    ctaTitle: ctaTitle(selected),
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
