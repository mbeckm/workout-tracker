/** The device's finish (SPEC §2): 212 Aluminium, 101 Graphite, 305 Signal, 408 Bone. */
export const FINISHES = ['212', '101', '305', '408'] as const;

export type Finish = (typeof FINISHES)[number];

export const DEFAULT_FINISH: Finish = '212';

/** The dark finish old dark-mode users get once (PLAN D2). */
export const DARK_FINISH: Finish = '101';

export function isFinish(value: unknown): value is Finish {
  return typeof value === 'string' && (FINISHES as readonly string[]).includes(value);
}

export function normalizeFinish(value: unknown): Finish {
  return isFinish(value) ? value : DEFAULT_FINISH;
}
