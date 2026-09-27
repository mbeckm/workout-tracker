import { showToast } from '@/components/toast';

/**
 * A new plan was kept: confirm it where the user lands, not on the editor that is leaving.
 * Done and every other way out of a new plan that has exercises end here, so the
 * confirmation doesn't depend on which way out the user took.
 *
 * - The toast rises once the editor has mostly left: the same beat Home waits before its
 *   week celebration, so it lands on the destination instead of on a screen sliding away.
 * - A plan that isn't active lands on Plans as a quiet row among others. Plans picks it up
 *   with `takeRevealedPlan()` on focus and lights that row once, so the eye finds it.
 */
export const PLAN_LANDING_DELAY_MS = 320;

/** A reveal nobody picked up by then is stale: never light a row on some later visit. */
const REVEAL_WINDOW_MS = 1500;

let pendingReveal: { planId: string; at: number } | null = null;

export function confirmPlanCreated(planId: string, options: { reveal: boolean }) {
  pendingReveal = options.reveal ? { planId, at: Date.now() } : null;
  setTimeout(() => showToast({ title: 'Plan created' }), PLAN_LANDING_DELAY_MS);
}

/** The plan Plans should light up on this focus, if any. Consumed on read. */
export function takeRevealedPlan(): string | null {
  const pending = pendingReveal;
  pendingReveal = null;
  if (!pending || Date.now() - pending.at > REVEAL_WINDOW_MS) {
    return null;
  }
  return pending.planId;
}
