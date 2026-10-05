/**
 * The wheel's load step (PRODUCT-DECISIONS 79): how far one notch moves the weight. Each lift
 * starts on its default step and a tap on the drum cycles finer ones (kg: 2.5 or 2 → 1 → 0.5;
 * lbs: 5 → 2.5 → 1). A chosen step is saved with the exercise (by name, like "last time"),
 * per unit, so it comes back every session. Pure: no React, no storage.
 *
 * Separate from `loadIncrement` on purpose: that is how much a Pro target adds, which stays a
 * real plate jump (2 kg on dumbbells) even though the dumbbell wheel steps 1 kg.
 */
import { loadIncrement, loadKind, type TargetPrescription, type TargetUnits } from '@/domain/targets';
import { normalizedStatsKey } from '@/domain/types';

/** A step chosen on the drum, saved with the exercise; kept only for the unit it was set in. */
export type SavedLoadStep = { units: TargetUnits; step: number };

/** Saved steps by `normalizedStatsKey(name)`. */
export type LoadSteps = Record<string, SavedLoadStep>;

/** The finer steps a tap cycles through after the default, per unit. */
const FINER: Record<TargetUnits, readonly number[]> = {
  kg: [1, 0.5],
  lbs: [2.5, 1],
};

/** The wheel's step before anyone taps: the target increment, but dumbbells in kg step 1. */
export function defaultLoadStep(prescription: TargetPrescription, units: TargetUnits): number {
  if (units === 'kg' && loadKind(prescription.equipments) === 'dumbbell') {
    return 1;
  }
  return loadIncrement(prescription, units);
}

/** Every step a tap cycles through, the default first, largest to smallest, no repeats. */
export function loadStepCycle(defaultStep: number, units: TargetUnits): number[] {
  const finer = FINER[units].filter((step) => step < defaultStep);
  return [defaultStep, ...finer];
}

/** The step after `current` in the cycle; back to the default after the finest. */
export function nextLoadStep(current: number, defaultStep: number, units: TargetUnits): number {
  const cycle = loadStepCycle(defaultStep, units);
  const index = cycle.indexOf(current);
  return cycle[(index + 1) % cycle.length] ?? defaultStep;
}

/** The step the wheel uses for this lift: the saved one when it is still in the cycle, else the default. */
export function loadStepFor(
  prescription: TargetPrescription,
  units: TargetUnits,
  saved: LoadSteps,
): number {
  const fallback = defaultLoadStep(prescription, units);
  const entry = saved[normalizedStatsKey(prescription.name)];
  if (!entry || entry.units !== units) {
    return fallback;
  }
  return loadStepCycle(fallback, units).includes(entry.step) ? entry.step : fallback;
}

/** `saved` with this lift's step set; the default step removes the entry. */
export function withLoadStep(saved: LoadSteps, name: string, units: TargetUnits, step: number, defaultStep: number): LoadSteps {
  const key = normalizedStatsKey(name);
  const { [key]: _old, ...rest } = saved;
  return step === defaultStep ? rest : { ...rest, [key]: { units, step } };
}

/** Drops anything malformed from a stored value. */
export function normalizeLoadSteps(value: unknown): LoadSteps {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const result: LoadSteps = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const candidate = entry as Partial<SavedLoadStep> | null;
    if (
      candidate &&
      (candidate.units === 'kg' || candidate.units === 'lbs') &&
      typeof candidate.step === 'number' &&
      Number.isFinite(candidate.step) &&
      candidate.step > 0
    ) {
      result[key] = { units: candidate.units, step: candidate.step };
    }
  }
  return result;
}

/** The display's step tag: `±2`, `±0.5`. */
export function loadStepText(step: number): string {
  return `±${Math.round(step * 100) / 100}`;
}
