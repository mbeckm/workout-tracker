import type { IntroEligibility, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

import { proPeriodLabel, type ProPeriod } from './entitlement';

export type IntroOffer = {
  isFreeTrial: boolean;
  priceString: string;
  periodUnit: string;
  periodNumberOfUnits: number;
  cycles: number;
};

export type ProOffer = {
  id: ProPeriod;
  pkg: PurchasesPackage;
  productId: string;
  /** "Yearly" */
  label: string;
  /** "Trim Pro Yearly" */
  title: string;
  /** Billed amount, the most prominent price. */
  priceString: string;
  /** "$49.99 per year" / "$99.99 once" */
  billedLine: string;
  /** Secondary only; annual. */
  pricePerMonthString: string | null;
  savingsPercent: number | null;
  /** Only when the store says this Apple Account is eligible. */
  intro: IntroOffer | null;
};

export type EligibilityMap = Record<string, Pick<IntroEligibility, 'status'>>;

const OFFER_ORDER: ProPeriod[] = ['annual', 'monthly', 'lifetime'];

/** INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE. On UNKNOWN, show the regular price. */
const INTRO_ELIGIBLE = 2;

function offerIdForPackage(pkg: PurchasesPackage): ProPeriod | null {
  const period = pkg.product.subscriptionPeriod;
  if (period === 'P1Y' || period === 'P12M') {
    return 'annual';
  }
  if (period === 'P1M') {
    return 'monthly';
  }
  if (period) {
    return null;
  }
  const type = String(pkg.packageType);
  if (type === 'ANNUAL') {
    return 'annual';
  }
  if (type === 'MONTHLY') {
    return 'monthly';
  }
  if (type === 'LIFETIME' || pkg.identifier.toLowerCase().includes('life')) {
    return 'lifetime';
  }
  return null;
}

/** First package per period, in display order. Periods we don't sell are skipped. */
export function pickProPackages(offering: Pick<PurchasesOffering, 'availablePackages'>) {
  const found = new Map<ProPeriod, PurchasesPackage>();
  for (const pkg of offering.availablePackages) {
    const id = offerIdForPackage(pkg);
    if (id && !found.has(id)) {
      found.set(id, pkg);
    }
  }
  return OFFER_ORDER.flatMap((id) => {
    const pkg = found.get(id);
    return pkg ? [{ id, pkg }] : [];
  });
}

function savingsPercent(monthly: number | null, annual: number | null): number | null {
  if (monthly == null || annual == null || monthly <= 0 || annual <= 0) {
    return null;
  }
  const yearOfMonthly = monthly * 12;
  if (annual >= yearOfMonthly) {
    return null;
  }
  const percent = Math.round((1 - annual / yearOfMonthly) * 100);
  return percent > 0 ? percent : null;
}

export function buildProOffers(
  offering: Pick<PurchasesOffering, 'availablePackages'>,
  eligibility: EligibilityMap,
): ProOffer[] {
  const picked = pickProPackages(offering);
  const monthlyPrice = picked.find((item) => item.id === 'monthly')?.pkg.product.price ?? null;
  const annualPrice = picked.find((item) => item.id === 'annual')?.pkg.product.price ?? null;

  return picked.map(({ id, pkg }) => {
    const product = pkg.product;
    const label = proPeriodLabel(id);
    const introPrice = product.introPrice;
    const eligible = eligibility[product.identifier]?.status === INTRO_ELIGIBLE;
    return {
      id,
      pkg,
      productId: product.identifier,
      label,
      title: `Trim Pro ${label}`,
      priceString: product.priceString,
      billedLine:
        id === 'lifetime'
          ? `${product.priceString} once`
          : `${product.priceString} per ${id === 'annual' ? 'year' : 'month'}`,
      pricePerMonthString: id === 'annual' ? product.pricePerMonthString : null,
      savingsPercent: id === 'annual' ? savingsPercent(monthlyPrice, annualPrice) : null,
      intro:
        id !== 'lifetime' && eligible && introPrice
          ? {
              isFreeTrial: introPrice.price === 0,
              priceString: introPrice.priceString,
              periodUnit: introPrice.periodUnit,
              periodNumberOfUnits: introPrice.periodNumberOfUnits,
              cycles: introPrice.cycles,
            }
          : null,
    };
  });
}

export function defaultOfferId(offers: ProOffer[]): ProPeriod | null {
  return offers[0]?.id ?? null;
}

function duration(count: number, unit: string): string {
  const word = unit.toLowerCase();
  return count === 1 ? `1 ${word}` : `${count} ${word}s`;
}

/** "Free for 1 week, then $49.99 per year." Only for eligible offers. */
export function introLine(offer: ProOffer): string | null {
  const intro = offer.intro;
  if (!intro) {
    return null;
  }
  const cycles = Math.max(1, intro.cycles);
  const then = `then ${offer.billedLine}.`;
  if (intro.isFreeTrial) {
    return `Free for ${duration(intro.periodNumberOfUnits * cycles, intro.periodUnit)}, ${then}`;
  }
  if (cycles > 1 && intro.periodNumberOfUnits === 1) {
    return `${intro.priceString} per ${intro.periodUnit.toLowerCase()} for ${duration(cycles, intro.periodUnit)}, ${then}`;
  }
  return `${intro.priceString} for ${duration(intro.periodNumberOfUnits * cycles, intro.periodUnit)}, ${then}`;
}

export type FreeTrial = {
  /** Whole days when the store period is days or weeks; null for month/year trials. */
  days: number | null;
  /** "7 days", "1 month". */
  length: string;
  /** "7-day", "1-month". For "Start 7-day free trial". */
  adjective: string;
};

/** The eligible free trial on this offer, from the store's intro price. Null for paid intros and ineligible accounts. */
export function freeTrial(offer: ProOffer | null): FreeTrial | null {
  const intro = offer?.intro;
  if (!intro?.isFreeTrial) {
    return null;
  }
  const count = intro.periodNumberOfUnits * Math.max(1, intro.cycles);
  if (count <= 0) {
    return null;
  }
  const unit = intro.periodUnit.toUpperCase();
  const days = unit === 'DAY' ? count : unit === 'WEEK' ? count * 7 : null;
  if (days != null) {
    return { days, length: duration(days, 'day'), adjective: `${days}-day` };
  }
  const word = unit.toLowerCase();
  return { days: null, length: duration(count, word), adjective: `${count}-${word}` };
}

/** "$39.99 a year" / "$6.99 a month" / "$99.99 once". The billed amount, for the most prominent price. */
export function billedPerPeriod(offer: ProOffer): string {
  if (offer.id === 'lifetime') {
    return `${offer.priceString} once`;
  }
  return `${offer.priceString} a ${offer.id === 'annual' ? 'year' : 'month'}`;
}

export function ctaTitle(offer: ProOffer | null): string {
  if (offer?.id === 'lifetime') {
    return 'Buy lifetime';
  }
  const trial = freeTrial(offer);
  if (trial) {
    return `Start ${trial.adjective} free trial`;
  }
  return 'Subscribe';
}

/** Schedule 2 §3.8(b) disclosure for the selected offer. Style it; don't shorten it. */
export function termsText(offer: ProOffer): string {
  if (offer.id === 'lifetime') {
    return `${offer.title}: ${offer.priceString}, one-time purchase. No subscription. Payment is charged to your Apple Account at confirmation.`;
  }
  const intro = introLine(offer);
  return [
    `${offer.title}: ${offer.billedLine}.`,
    intro,
    offer.intro?.isFreeTrial
      ? 'Payment is charged to your Apple Account when the free trial ends.'
      : 'Payment is charged to your Apple Account at confirmation.',
    'The subscription renews automatically unless cancelled at least 24 hours before the end of the current period. Your account is charged for renewal within 24 hours before the current period ends.',
    offer.intro?.isFreeTrial
      ? 'Any unused part of a free trial ends when you buy a subscription.'
      : null,
    'Manage or cancel in Settings › Apple Account › Subscriptions.',
  ]
    .filter(Boolean)
    .join(' ');
}
