/**
 * The device's finish (decision 80): six whole machines, each a body and its screen.
 * 212 Aluminium (amber), 101 Graphite (White Night), 707 Field (paper), 089 Pocket (pea),
 * 077 Bunker (phosphor), 777 Holo (ice VFD). A finish that no longer exists (305 Signal,
 * 408 Bone) falls back to 212.
 */
export const FINISHES = ['212', '101', '707', '089', '077', '777'] as const;

export type Finish = (typeof FINISHES)[number];

export const DEFAULT_FINISH: Finish = '212';

/** The dark finish old dark-mode users get once (PLAN D2). */
export const DARK_FINISH: Finish = '101';

/** Finishes without Trim Pro: Aluminium, and Graphite (given at the end of onboarding). */
export const FREE_FINISHES: readonly Finish[] = ['212', '101'];

export function isFinish(value: unknown): value is Finish {
  return typeof value === 'string' && (FINISHES as readonly string[]).includes(value);
}

export function normalizeFinish(value: unknown): Finish {
  return isFinish(value) ? value : DEFAULT_FINISH;
}
