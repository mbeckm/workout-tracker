import Constants, { ExecutionEnvironment } from 'expo-constants';
import { LogBox, NativeModules, Platform } from 'react-native';

/** Must match the entitlement identifier in the RevenueCat dashboard. */
export const PRO_ENTITLEMENT = 'Scratch Pro';

export type ProPlanId = 'monthly' | 'annual' | 'lifetime';

export type ProPlan = {
  id: ProPlanId;
  title: string;
  price: string;
  detail: string;
  cta: string;
  available: boolean;
  savingsPercent: number | null;
};

const PLAN_ORDER: ProPlanId[] = ['monthly', 'annual', 'lifetime'];

const PLAN_COPY: Record<ProPlanId, { title: string; detail: string; cta: string }> = {
  monthly: { title: 'MONTHLY', detail: 'Billed monthly', cta: 'Subscribe to Monthly' },
  annual: { title: 'ANNUAL', detail: 'Billed annually', cta: 'Subscribe to Annual' },
  lifetime: { title: 'LIFETIME', detail: 'Pay once', cta: 'Purchase Lifetime' },
};

type PurchasesPackage = {
  identifier: string;
  packageType: string;
  product: { price: number; priceString: string };
};

type CustomerInfo = {
  entitlements: { active: Record<string, unknown> };
};

type Offerings = {
  current?: {
    monthly?: PurchasesPackage;
    annual?: PurchasesPackage;
    lifetime?: PurchasesPackage;
    availablePackages: PurchasesPackage[];
  } | null;
};

type PurchasesSdk = {
  configure: (options: { apiKey: string }) => void;
  setLogLevel?: (level: unknown) => void;
  getCustomerInfo: () => Promise<CustomerInfo>;
  getOfferings: () => Promise<Offerings>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<unknown>;
  restorePurchases: () => Promise<unknown>;
  LOG_LEVEL?: { ERROR: unknown; INFO: unknown };
};

type PurchasesUiSdk = {
  default?: {
    presentPaywallIfNeeded: (options: { requiredEntitlementIdentifier: string }) => Promise<string>;
  };
  presentPaywallIfNeeded?: (options: { requiredEntitlementIdentifier: string }) => Promise<string>;
  PAYWALL_RESULT: {
    PURCHASED: string;
    RESTORED: string;
    NOT_PRESENTED: string;
    CANCELLED: string;
  };
};

let packagesById: Partial<Record<ProPlanId, PurchasesPackage>> = {};

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
}

let configured = false;
let purchasesSdk: PurchasesSdk | null | undefined;

function nativePurchases(): PurchasesSdk | null {
  if (isExpoGo || Platform.OS === 'web') {
    return null;
  }
  if (purchasesSdk !== undefined) {
    return purchasesSdk;
  }
  try {
    const mod = require('react-native-purchases') as { default?: PurchasesSdk } & PurchasesSdk;
    purchasesSdk = (mod.default ?? mod) as PurchasesSdk;
  } catch {
    purchasesSdk = null;
  }
  return purchasesSdk;
}

function nativePurchasesUi(): PurchasesUiSdk | null {
  if (isExpoGo || Platform.OS === 'web') {
    return null;
  }
  try {
    return require('react-native-purchases-ui') as PurchasesUiSdk;
  } catch {
    return null;
  }
}

export async function configurePurchases(): Promise<void> {
  if (!apiKey || configured || !purchasesConfigured) {
    return;
  }

  const Purchases = nativePurchases();
  if (!Purchases) {
    return;
  }

  try {
    const errorLevel = Purchases.LOG_LEVEL?.ERROR ?? Purchases.LOG_LEVEL?.INFO;
    if (errorLevel != null && typeof Purchases.setLogLevel === 'function') {
      Purchases.setLogLevel(errorLevel);
    }
    Purchases.configure({ apiKey });
    configured = true;
  } catch {
    configured = false;
  }
}

export async function isProEntitlementActive(): Promise<boolean> {
  if (!purchasesConfigured) {
    return false;
  }

  const Purchases = nativePurchases();
  if (!Purchases) {
    return false;
  }

  try {
    await configurePurchases();
    const info = await Purchases.getCustomerInfo();
    return info.entitlements.active[PRO_ENTITLEMENT] != null;
  } catch {
    return false;
  }
}

function planIdForPackage(pkg: PurchasesPackage): ProPlanId | null {
  const type = String(pkg.packageType);
  if (type === 'MONTHLY') {
    return 'monthly';
  }
  if (type === 'ANNUAL') {
    return 'annual';
  }
  if (type === 'LIFETIME') {
    return 'lifetime';
  }
  const identifier = pkg.identifier.toLowerCase();
  if (identifier.includes('month')) {
    return 'monthly';
  }
  if (identifier.includes('annual') || identifier.includes('year')) {
    return 'annual';
  }
  if (identifier.includes('life')) {
    return 'lifetime';
  }
  return null;
}

export function defaultProPlans(): ProPlan[] {
  return PLAN_ORDER.map((id) => ({
    id,
    ...PLAN_COPY[id],
    price: '—',
    available: false,
    savingsPercent: null,
  }));
}

function annualSavingsPercent(monthlyPrice: number | null, annualPrice: number | null): number | null {
  if (monthlyPrice == null || annualPrice == null || monthlyPrice <= 0 || annualPrice <= 0) {
    return null;
  }
  const yearOfMonthly = monthlyPrice * 12;
  if (annualPrice >= yearOfMonthly) {
    return null;
  }
  return Math.round((1 - annualPrice / yearOfMonthly) * 100);
}

export async function fetchProPlans(): Promise<ProPlan[]> {
  if (!purchasesConfigured) {
    packagesById = {};
    return defaultProPlans();
  }

  const Purchases = nativePurchases();
  if (!Purchases) {
    packagesById = {};
    return defaultProPlans();
  }

  try {
    await configurePurchases();
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    const found: Partial<Record<ProPlanId, PurchasesPackage>> = {};

    if (current?.monthly) {
      found.monthly = current.monthly;
    }
    if (current?.annual) {
      found.annual = current.annual;
    }
    if (current?.lifetime) {
      found.lifetime = current.lifetime;
    }

    for (const pkg of current?.availablePackages ?? []) {
      const id = planIdForPackage(pkg);
      if (id && !found[id]) {
        found[id] = pkg;
      }
    }

    packagesById = found;
    const monthlyPrice = found.monthly?.product.price ?? null;
    const annualPrice = found.annual?.product.price ?? null;
    const savings = annualSavingsPercent(monthlyPrice, annualPrice);

    return PLAN_ORDER.map((id) => {
      const pkg = found[id];
      return {
        id,
        ...PLAN_COPY[id],
        price: pkg?.product.priceString ?? '—',
        available: pkg != null,
        savingsPercent: id === 'annual' ? savings : null,
      };
    });
  } catch {
    packagesById = {};
    return defaultProPlans();
  }
}

export async function purchaseProPlan(id: ProPlanId): Promise<{
  ok: boolean;
  isPro: boolean;
  message: string;
}> {
  if (isExpoGo) {
    return {
      ok: false,
      isPro: false,
      message:
        'Expo Go cannot talk to the App Store. Purchases need a development build and the Apple public SDK key (starts with appl_).',
    };
  }

  if (!apiKey) {
    return {
      ok: false,
      isPro: false,
      message: 'Missing EXPO_PUBLIC_REVENUECAT_API_KEY.',
    };
  }

  const pkg = packagesById[id];
  if (!pkg) {
    return {
      ok: false,
      isPro: false,
      message: 'This plan is not in the current RevenueCat offering yet.',
    };
  }

  const Purchases = nativePurchases();
  if (!Purchases) {
    return { ok: false, isPro: false, message: 'Purchases are not available in this build.' };
  }

  try {
    await configurePurchases();
    await Purchases.purchasePackage(pkg);
    const isPro = await isProEntitlementActive();
    return {
      ok: isPro,
      isPro,
      message: isPro ? 'Trim Pro is on.' : 'Purchase completed, but Trim Pro is not active yet.',
    };
  } catch (error) {
    const cancelled =
      error != null &&
      typeof error === 'object' &&
      'userCancelled' in error &&
      Boolean((error as { userCancelled?: boolean }).userCancelled);
    return {
      ok: false,
      isPro: false,
      message: cancelled
        ? 'Purchase cancelled.'
        : error instanceof Error
          ? error.message
          : 'Purchase failed.',
    };
  }
}

export async function presentScratchPaywall(): Promise<{
  ok: boolean;
  isPro: boolean;
  message: string;
}> {
  if (isExpoGo) {
    return {
      ok: false,
      isPro: false,
      message:
        'Expo Go cannot talk to the App Store. Purchases need a development build and the Apple public SDK key (starts with appl_), not the Test Store key (starts with test_).',
    };
  }

  if (!apiKey) {
    return {
      ok: false,
      isPro: false,
      message: 'Missing EXPO_PUBLIC_REVENUECAT_API_KEY.',
    };
  }

  const ui = nativePurchasesUi();
  const present = ui?.default?.presentPaywallIfNeeded ?? ui?.presentPaywallIfNeeded;
  if (!ui || !present) {
    return { ok: false, isPro: false, message: 'Purchases are not available in this build.' };
  }

  try {
    await configurePurchases();
    const result = await present({
      requiredEntitlementIdentifier: PRO_ENTITLEMENT,
    });

    const isPro = await isProEntitlementActive();
    const purchased =
      result === ui.PAYWALL_RESULT.PURCHASED ||
      result === ui.PAYWALL_RESULT.RESTORED ||
      isPro;

    return {
      ok: purchased,
      isPro,
      message:
        result === ui.PAYWALL_RESULT.NOT_PRESENTED
          ? 'Already subscribed.'
          : result === ui.PAYWALL_RESULT.CANCELLED
            ? 'Purchase cancelled.'
            : purchased
              ? 'Trim Pro is on.'
              : 'No purchase completed.',
    };
  } catch (error) {
    const details = error instanceof Error ? error.message : 'Paywall failed.';
    return {
      ok: false,
      isPro: false,
      message: details,
    };
  }
}

export async function restorePurchases(): Promise<{
  ok: boolean;
  isPro: boolean;
  message: string;
}> {
  if (isExpoGo) {
    return {
      ok: false,
      isPro: false,
      message: 'Restore only works in a development or TestFlight build.',
    };
  }

  if (!apiKey || Platform.OS === 'web') {
    return { ok: false, isPro: false, message: 'Purchases are not configured.' };
  }

  const Purchases = nativePurchases();
  if (!Purchases) {
    return { ok: false, isPro: false, message: 'Purchases are not available in this build.' };
  }

  try {
    await configurePurchases();
    await Purchases.restorePurchases();
    const isPro = await isProEntitlementActive();
    return {
      ok: true,
      isPro,
      message: isPro ? 'Trim Pro restored.' : 'No active subscription found.',
    };
  } catch (error) {
    return {
      ok: false,
      isPro: false,
      message: error instanceof Error ? error.message : 'Restore failed.',
    };
  }
}
