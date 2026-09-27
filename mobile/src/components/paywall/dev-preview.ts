import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

import type { Entitlement } from '@/purchases/entitlement';
import { buildProOffers, type EligibilityMap, type ProOffer } from '@/purchases/offers';
import type { ProReason } from '@/purchases/pro-gate';
import type { OffersResult, PurchaseOutcome, RestoreOutcome } from '@/purchases/purchases';

/**
 * Development-only paywall previews: `/paywall?reason=onboarding&mock=trial`.
 * Lets the design be screenshotted on web or a simulator without StoreKit.
 * Prices here are sample data for the preview; the real screen only shows store prices.
 *
 * In a preview, Subscribe and Restore resolve locally after a short beat (no StoreKit, and
 * the real entitlement is never touched), so the whole purchase → success moment can be
 * watched. `success`, `success-notrial` and `restored` open straight on the success state.
 */
export const PAYWALL_MOCKS = [
  'trial',
  'notrial',
  'unavailable',
  'offline',
  'loading',
  'success',
  'success-notrial',
  'restored',
] as const;
export type PaywallMock = (typeof PAYWALL_MOCKS)[number];

type MockProduct = {
  identifier: string;
  packageType: 'ANNUAL' | 'MONTHLY';
  subscriptionPeriod: 'P1Y' | 'P1M';
  price: number;
  priceString: string;
  pricePerMonthString: string;
  trialDays: number | null;
};

const PRODUCTS: MockProduct[] = [
  {
    identifier: 'trim_pro_yearly',
    packageType: 'ANNUAL',
    subscriptionPeriod: 'P1Y',
    price: 39.99,
    priceString: '$39.99',
    pricePerMonthString: '$3.33',
    trialDays: 7,
  },
  {
    identifier: 'trim_pro_monthly',
    packageType: 'MONTHLY',
    subscriptionPeriod: 'P1M',
    price: 6.99,
    priceString: '$6.99',
    pricePerMonthString: '$6.99',
    trialDays: null,
  },
];

function mockPackage(product: MockProduct): PurchasesPackage {
  return {
    identifier: `$rc_${product.packageType.toLowerCase()}`,
    packageType: product.packageType,
    product: {
      identifier: product.identifier,
      subscriptionPeriod: product.subscriptionPeriod,
      price: product.price,
      priceString: product.priceString,
      pricePerMonthString: product.pricePerMonthString,
      introPrice: product.trialDays
        ? {
            price: 0,
            priceString: '$0.00',
            cycles: 1,
            period: `P${product.trialDays}D`,
            periodUnit: 'DAY',
            periodNumberOfUnits: product.trialDays,
          }
        : null,
    },
  } as unknown as PurchasesPackage;
}

function mockOffers(eligible: boolean): OffersResult {
  const offering = {
    identifier: 'preview',
    availablePackages: PRODUCTS.map(mockPackage),
  } as unknown as PurchasesOffering;
  const eligibility: EligibilityMap = Object.fromEntries(
    PRODUCTS.map((product) => [product.identifier, { status: eligible ? 2 : 1 }]),
  );
  return { status: 'ok', offering, offers: buildProOffers(offering, eligibility) };
}

export type PaywallPreview = {
  loadOffers: (reason: ProReason) => Promise<OffersResult>;
  /** Stands in for StoreKit: a completed purchase after a short beat. */
  purchase: (offer: ProOffer) => Promise<PurchaseOutcome>;
  /** Stands in for a restore that finds Trim Pro. */
  restore: () => Promise<RestoreOutcome>;
  /** Open straight on the success state, as if this had just happened. */
  opensOn: 'purchased' | 'restored' | null;
};

/** Long enough to read "Purchasing…", short enough not to bore. */
const STORE_BEAT_MS = 900;

function previewEntitlement(offer: ProOffer | null): Entitlement {
  return {
    status: 'pro',
    productId: offer?.productId ?? 'trim_pro_yearly',
    period: offer?.id ?? 'annual',
    expiresAt: null,
    willRenew: true,
  };
}

function afterBeat<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), STORE_BEAT_MS));
}

const load = {
  trial: () => Promise.resolve(mockOffers(true)),
  notrial: () => Promise.resolve(mockOffers(false)),
  unavailable: () => Promise.resolve<OffersResult>({ status: 'unavailable' }),
  offline: () => Promise.resolve<OffersResult>({ status: 'offline' }),
  loading: () => new Promise<OffersResult>(() => undefined),
};

function preview(
  loadOffers: (reason: ProReason) => Promise<OffersResult>,
  opensOn: PaywallPreview['opensOn'] = null,
): PaywallPreview {
  return {
    loadOffers,
    purchase: (offer) => afterBeat({ kind: 'success', entitlement: previewEntitlement(offer) }),
    restore: () => afterBeat({ kind: 'restored', entitlement: previewEntitlement(null) }),
    opensOn,
  };
}

/** Module-level so the controller sees a stable preview per mode. */
const PREVIEWS: Record<PaywallMock, PaywallPreview> = {
  trial: preview(load.trial),
  notrial: preview(load.notrial),
  unavailable: preview(load.unavailable),
  offline: preview(load.offline),
  loading: preview(load.loading),
  success: preview(load.trial, 'purchased'),
  'success-notrial': preview(load.notrial, 'purchased'),
  restored: preview(load.trial, 'restored'),
};

/** The preview for `?mock=`, or undefined. Always undefined outside development builds. */
export function paywallPreview(mock: unknown): PaywallPreview | undefined {
  if (!__DEV__) {
    return undefined;
  }
  const raw = Array.isArray(mock) ? mock[0] : mock;
  return (PAYWALL_MOCKS as readonly unknown[]).includes(raw) ? PREVIEWS[raw as PaywallMock] : undefined;
}
