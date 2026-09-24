import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

import { buildProOffers, type EligibilityMap } from '@/purchases/offers';
import type { ProReason } from '@/purchases/pro-gate';
import type { OffersResult } from '@/purchases/purchases';

/**
 * Development-only paywall previews: `/paywall?reason=onboarding&mock=trial`.
 * Lets the design be screenshotted on web or a simulator without StoreKit.
 * Prices here are sample data for the preview; the real screen only shows store prices.
 */
export const PAYWALL_MOCKS = ['trial', 'notrial', 'unavailable', 'offline', 'loading'] as const;
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

/** Module-level so the controller sees a stable loader per mode. */
const LOADERS: Record<PaywallMock, (reason: ProReason) => Promise<OffersResult>> = {
  trial: () => Promise.resolve(mockOffers(true)),
  notrial: () => Promise.resolve(mockOffers(false)),
  unavailable: () => Promise.resolve({ status: 'unavailable' }),
  offline: () => Promise.resolve({ status: 'offline' }),
  loading: () => new Promise<OffersResult>(() => undefined),
};

/** The preview loader for `?mock=`, or undefined. Always undefined outside development builds. */
export function paywallPreviewLoader(
  mock: unknown,
): ((reason: ProReason) => Promise<OffersResult>) | undefined {
  if (!__DEV__) {
    return undefined;
  }
  const raw = Array.isArray(mock) ? mock[0] : mock;
  return (PAYWALL_MOCKS as readonly unknown[]).includes(raw) ? LOADERS[raw as PaywallMock] : undefined;
}
