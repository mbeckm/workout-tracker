import type { CustomerInfo, PurchasesEntitlementInfo } from 'react-native-purchases';

/** Must match the entitlement identifier in the RevenueCat dashboard exactly (case-sensitive). */
export const PRO_ENTITLEMENT = 'Scratch Pro';

export type ProPeriod = 'monthly' | 'annual' | 'lifetime';

export type Entitlement = {
  /** `unknown` (offline, SDK error, no SDK) never overwrites a known value. */
  status: 'pro' | 'free' | 'unknown';
  productId: string | null;
  period: ProPeriod | null;
  expiresAt: string | null;
  willRenew: boolean | null;
};

export const UNKNOWN_ENTITLEMENT: Entitlement = {
  status: 'unknown',
  productId: null,
  period: null,
  expiresAt: null,
  willRenew: null,
};

const FREE_ENTITLEMENT: Entitlement = { ...UNKNOWN_ENTITLEMENT, status: 'free' };

/** Product periods seen in loaded offerings; the entitlement itself doesn't carry one. */
const knownProductPeriods = new Map<string, ProPeriod>();

export function rememberProductPeriod(productId: string, period: ProPeriod): void {
  knownProductPeriods.set(productId, period);
}

function periodForEntitlement(info: PurchasesEntitlementInfo): ProPeriod | null {
  if (info.expirationDate == null) {
    return 'lifetime';
  }
  const known = knownProductPeriods.get(info.productIdentifier);
  if (known) {
    return known;
  }
  const id = info.productIdentifier.toLowerCase();
  if (id.includes('year') || id.includes('annual')) {
    return 'annual';
  }
  if (id.includes('month')) {
    return 'monthly';
  }
  return null;
}

export function entitlementFromCustomerInfo(customerInfo: CustomerInfo): Entitlement {
  const info = customerInfo.entitlements.active[PRO_ENTITLEMENT];
  if (!info || !info.isActive) {
    return FREE_ENTITLEMENT;
  }
  return {
    status: 'pro',
    productId: info.productIdentifier,
    period: periodForEntitlement(info),
    expiresAt: info.expirationDate,
    willRenew: info.willRenew,
  };
}

/**
 * Drops CustomerInfo older than the newest one already applied, so a slow launch
 * `getCustomerInfo` can't overwrite a purchase that finished first.
 */
export function createCustomerInfoOrdering() {
  let newestRequestMs = Number.NEGATIVE_INFINITY;
  return {
    /** Returns true when `info` is at least as new as everything seen so far, and records it. */
    accept(info: Pick<CustomerInfo, 'requestDate'>): boolean {
      const requestMs = Date.parse(info.requestDate);
      if (!Number.isFinite(requestMs)) {
        return true;
      }
      if (requestMs < newestRequestMs) {
        return false;
      }
      newestRequestMs = requestMs;
      return true;
    },
  };
}

export function proPeriodLabel(period: ProPeriod): string {
  switch (period) {
    case 'annual':
      return 'Yearly';
    case 'monthly':
      return 'Monthly';
    case 'lifetime':
      return 'Lifetime';
  }
}
