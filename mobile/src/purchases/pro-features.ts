import type { ProReason } from './pro-gate';

export type ProFeatureId = 'plans' | 'progress' | 'targets';

export type ProFeature = {
  id: ProFeatureId;
  /** Row title, 17. What the buyer gets, stated as a fact. */
  title: string;
  /** One line under it, 15. */
  detail: string;
  /**
   * True only once the feature works in the app and its gate is wired. The
   * paywall never names an unshipped feature (App Review 3.1.2(c), 2.3.1).
   */
  shipped: boolean;
  /** Gates that lead with this row. */
  reasons: readonly ProReason[];
};

/** Everything Trim Pro includes, in default order. Flip `shipped` when a feature lands. */
export const PRO_FEATURES: readonly ProFeature[] = [
  {
    id: 'plans',
    title: 'Unlimited plans',
    detail: 'Keep every plan you build and switch between them anytime.',
    shipped: true,
    reasons: ['second_plan', 'switch_plan'],
  },
  {
    id: 'progress',
    title: 'Your full progress',
    detail: 'Every lift since your first session, plus body trends.',
    shipped: true,
    reasons: ['progress_history', 'body_trends'],
  },
  {
    id: 'targets',
    title: 'Next-session targets',
    detail: 'The weight and reps for every set, worked out from last time.',
    shipped: true,
    reasons: ['targets'],
  },
];

/**
 * Up to `limit` shipped features, with the one this gate is about first.
 * Pure: pass `features` to test.
 */
export function proFeaturesFor(
  reason: ProReason,
  features: readonly ProFeature[] = PRO_FEATURES,
  limit = 3,
): ProFeature[] {
  const shipped = features.filter((feature) => feature.shipped);
  const lead = shipped.filter((feature) => feature.reasons.includes(reason));
  const rest = shipped.filter((feature) => !feature.reasons.includes(reason));
  return [...lead, ...rest].slice(0, limit);
}
