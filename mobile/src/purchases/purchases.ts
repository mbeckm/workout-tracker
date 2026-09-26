import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Linking, LogBox, NativeModules, Platform } from 'react-native';
import type PurchasesClass from 'react-native-purchases';
import type { CustomerInfo, CustomerInfoUpdateListener, PurchasesOffering } from 'react-native-purchases';

import {
  createCustomerInfoOrdering,
  entitlementFromCustomerInfo,
  rememberProductPeriod,
  type Entitlement,
} from './entitlement';
import type { ProReason } from './pro-gate';
import { buildProOffers, pickProPackages, type EligibilityMap, type ProOffer } from './offers';
import { track } from '@/analytics/analytics';

export { PRO_ENTITLEMENT, proPeriodLabel, type Entitlement, type ProPeriod } from './entitlement';
export type { ProOffer } from './offers';

type Sdk = typeof PurchasesClass;

const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '';

/**
 * `appOwnership === 'expo'` is deprecated and often null on SDK 57.
 * Dev clients also report `storeClient`, but they ship EXDevLauncher.
 */
function detectExpoGo(): boolean {
  if (Platform.OS === 'web') {
    return false;
  }
  if (Constants.appOwnership === 'expo') {
    return true;
  }
  if (NativeModules.EXDevLauncher != null) {
    return false;
  }
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

function isPublicStoreKey(key: string): boolean {
  if (Platform.OS === 'ios') {
    return key.startsWith('appl_');
  }
  if (Platform.OS === 'android') {
    return key.startsWith('goog_');
  }
  return false;
}

export const isExpoGo = detectExpoGo();

/** Test Store keys (`test_`) 401 in Expo Go and must not configure the SDK. */
export const purchasesConfigured =
  Boolean(apiKey) && !isExpoGo && Platform.OS !== 'web' && isPublicStoreKey(apiKey);

if (__DEV__) {
  LogBox.ignoreLogs([/\[RevenueCat\]/, 'Invalid API Key', 'credentials issue']);
  if (!purchasesConfigured) {
    console.warn(
      '[purchases] Unavailable in this build: needs a development or store build and an appl_ EXPO_PUBLIC_REVENUECAT_API_KEY.',
    );
  }
}

let sdk: Sdk | null | undefined;

/** The configured SDK, or null in Expo Go, on web, or without a store key. */
function purchasesSdk(): Sdk | null {
  if (sdk !== undefined) {
    return sdk;
  }
  sdk = null;
  if (!purchasesConfigured) {
    return sdk;
  }
  try {
    // Lazy so Expo Go and web never load the native module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-purchases') as { default?: Sdk } & Sdk;
    const Purchases = mod.default ?? mod;
    void Purchases.setLogLevel(Purchases.LOG_LEVEL.ERROR).catch(() => undefined);
    Purchases.configure({ apiKey });
    sdk = Purchases;
  } catch (error) {
    if (__DEV__) {
      console.warn('[purchases] configure failed', error);
    }
  }
  return sdk;
}

// ---------------------------------------------------------------------------
// Entitlement

const ordering = createCustomerInfoOrdering();

/** Maps CustomerInfo, or returns null when it is older than what was already applied. */
function freshEntitlement(info: CustomerInfo): Entitlement | null {
  return ordering.accept(info) ? entitlementFromCustomerInfo(info) : null;
}

/**
 * Configures once, reads the current CustomerInfo, then follows every update
 * (renewals, expirations, refunds, Ask to Buy approvals, other devices; the SDK
 * refreshes on foreground). Errors report nothing, so a cached Pro stays Pro.
 * Returns an unsubscribe function.
 */
export function startEntitlementSync(onChange: (entitlement: Entitlement) => void): () => void {
  const Purchases = purchasesSdk();
  if (!Purchases) {
    return () => undefined;
  }
  let active = true;
  const listener: CustomerInfoUpdateListener = (info) => {
    const entitlement = active ? freshEntitlement(info) : null;
    if (entitlement) {
      onChange(entitlement);
    }
  };
  Purchases.addCustomerInfoUpdateListener(listener);
  Purchases.getCustomerInfo().then(listener, (error: unknown) => {
    if (__DEV__) {
      console.warn('[purchases] getCustomerInfo failed; keeping cached Pro state', error);
    }
  });
  return () => {
    active = false;
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}

// ---------------------------------------------------------------------------
// User-facing copy

export const PURCHASE_COPY = {
  unavailable: "Purchases aren't available right now. Please try again later.",
  notActiveYet:
    "Your purchase went through. If Trim Pro doesn't turn on in a moment, tap Restore Purchases.",
  pendingTitle: 'Waiting for approval',
  pendingBody: "Trim Pro turns on as soon as the purchase is approved.",
  restoredTitle: 'Trim Pro restored',
  restoredBody: 'Welcome back. Pro is on.',
  noneTitle: 'No purchases found',
  noneBody:
    "We couldn't find Trim Pro on this Apple Account. If you subscribed with a different Apple Account, sign in with it and try again.",
  restoreFailedTitle: "Couldn't restore purchases",
  restoreFailed: "Couldn't restore purchases. Check your connection and try again.",
} as const;

const ERROR = {
  cancelled: '1',
  storeProblem: '2',
  notAllowed: '3',
  alreadyPurchased: '6',
  network: '10',
  paymentPending: '20',
  offline: '35',
} as const;

function errorCode(error: unknown): string | null {
  if (error != null && typeof error === 'object' && 'code' in error) {
    return String((error as { code: unknown }).code);
  }
  return null;
}

function isCancelled(error: unknown): boolean {
  return (
    errorCode(error) === ERROR.cancelled ||
    (error != null &&
      typeof error === 'object' &&
      (error as { userCancelled?: unknown }).userCancelled === true)
  );
}

function isOffline(error: unknown): boolean {
  const code = errorCode(error);
  return code === ERROR.network || code === ERROR.offline;
}

function purchaseErrorMessage(error: unknown): string {
  switch (errorCode(error)) {
    case ERROR.network:
    case ERROR.offline:
      return "You're offline. Connect and try again.";
    case ERROR.storeProblem:
      return "The App Store couldn't complete the purchase. Please try again.";
    case ERROR.notAllowed:
      return "This Apple Account can't make purchases. Check Screen Time settings.";
    case ERROR.alreadyPurchased:
      return 'You already own Trim Pro. Tap Restore Purchases.';
    default:
      return "The purchase didn't go through. Please try again.";
  }
}

// ---------------------------------------------------------------------------
// Offers

export type OffersResult =
  | { status: 'ok'; offering: PurchasesOffering; offers: ProOffer[] }
  | { status: 'offline' | 'unavailable' };

/**
 * The offering for this placement (falls back to the current offering), with intro
 * pricing only where the store says the account is eligible.
 */
export async function loadProOffers(reason: ProReason): Promise<OffersResult> {
  const Purchases = purchasesSdk();
  if (!Purchases) {
    return { status: 'unavailable' };
  }
  try {
    let offering: PurchasesOffering | null = null;
    try {
      offering = await Purchases.getCurrentOfferingForPlacement(reason);
    } catch {
      offering = null;
    }
    offering ??= (await Purchases.getOfferings()).current;
    if (!offering || pickProPackages(offering).length === 0) {
      return { status: 'unavailable' };
    }

    const productIds = pickProPackages(offering).map(({ pkg }) => pkg.product.identifier);
    let eligibility: EligibilityMap = {};
    try {
      eligibility = await Purchases.checkTrialOrIntroductoryPriceEligibility(productIds);
    } catch {
      eligibility = {};
    }

    const offers = buildProOffers(offering, eligibility);
    for (const offer of offers) {
      rememberProductPeriod(offer.productId, offer.id);
    }
    return { status: 'ok', offering, offers };
  } catch (error) {
    return { status: isOffline(error) ? 'offline' : 'unavailable' };
  }
}

export function trackPaywallImpression(reason: ProReason, offering: PurchasesOffering): void {
  track('paywall_viewed', { reason });
  const Purchases = purchasesSdk();
  if (!Purchases) {
    return;
  }
  try {
    void Purchases.trackCustomPaywallImpression({ paywallId: `in_app:${reason}`, offering }).catch(
      () => undefined,
    );
  } catch {
    // Analytics only.
  }
}

// ---------------------------------------------------------------------------
// Purchase, restore, manage

export type PurchaseOutcome =
  | { kind: 'success'; entitlement: Entitlement }
  | { kind: 'cancelled' }
  | { kind: 'pending' }
  | { kind: 'error'; message: string };

export async function purchaseOffer(offer: ProOffer): Promise<PurchaseOutcome> {
  const Purchases = purchasesSdk();
  if (!Purchases) {
    return { kind: 'error', message: PURCHASE_COPY.unavailable };
  }
  try {
    const { customerInfo } = await Purchases.purchasePackage(offer.pkg);
    return {
      kind: 'success',
      entitlement: freshEntitlement(customerInfo) ?? entitlementFromCustomerInfo(customerInfo),
    };
  } catch (error) {
    if (isCancelled(error)) {
      return { kind: 'cancelled' };
    }
    if (errorCode(error) === ERROR.paymentPending) {
      return { kind: 'pending' };
    }
    return { kind: 'error', message: purchaseErrorMessage(error) };
  }
}

export type RestoreOutcome =
  | { kind: 'restored'; entitlement: Entitlement }
  | { kind: 'none'; entitlement: Entitlement }
  | { kind: 'error'; message: string };

export async function restorePurchases(): Promise<RestoreOutcome> {
  const Purchases = purchasesSdk();
  if (!Purchases) {
    return { kind: 'error', message: PURCHASE_COPY.unavailable };
  }
  try {
    const info = await Purchases.restorePurchases();
    const entitlement = freshEntitlement(info) ?? entitlementFromCustomerInfo(info);
    return entitlement.status === 'pro'
      ? { kind: 'restored', entitlement }
      : { kind: 'none', entitlement };
  } catch (error) {
    return {
      kind: 'error',
      message: isOffline(error) ? "You're offline. Connect and try again." : PURCHASE_COPY.restoreFailed,
    };
  }
}

const APPLE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

/** Apple's manage-subscription sheet; the App Store subscriptions page when the SDK can't show it. */
export async function manageSubscription(): Promise<void> {
  const Purchases = purchasesSdk();
  try {
    if (!Purchases) {
      throw new Error('unavailable');
    }
    await Purchases.showManageSubscriptions();
  } catch {
    await Linking.openURL(APPLE_SUBSCRIPTIONS_URL).catch(() => undefined);
  }
}
