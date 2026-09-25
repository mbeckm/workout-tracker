/**
 * Next-session targets (Trim Pro): for each set today, what to lift based on last time,
 * so progressing never needs math at the rack. Pure: no React, no storage.
 *
 * The rule is double progression on the plan's fixed reps:
 *
 * 1. Load goes up only when last session hit the prescribed reps on every working set
 *    (the plan's set count, all logged) and was not a regression. Each set's target is
 *    then its last load plus one increment, at the prescribed reps.
 * 2. Otherwise each set holds its load and aims for last time's reps + 1 on that set,
 *    capped at the prescribed reps.
 * 3. Regression or deload (last session scored under 90% of the one before, by best
 *    Epley 10RM, else total reps or seconds): hold. Load never goes up after a bad day,
 *    and nothing ever jumps back to older numbers: targets only look at last time.
 *
 * Increments (`INCREMENTS`) come from the unit, the equipment and compound vs isolation.
 * A new load is the next step on that increment's grid above last time's load, so an
 * off-grid 61 kg bar suggests 62.5, and a load is never zero or negative.
 *
 * Other tracking modes:
 * - Reps only (bodyweight), or a weighted move logged without load: +1 rep up to the
 *   plan; once every set hits it, +1 rep on each set.
 * - Assisted (counterweight): the same rule, but the step removes assistance. At the
 *   lightest assistance it adds a rep instead of suggesting zero.
 * - Holds (seconds): +5 s, capped at the plan's duration until every set reaches it.
 * - Cardio, stretches, mobility, timers and distance work: no target.
 * - No history: no target.
 */
import { classifyExerciseSize } from '@/domain/rest';
import { durationIsMinutes, repsForSet, setCount, tenRMForSet } from '@/domain/helpers';
import type { ExercisePrescription, LoggedSet, LoggedWorkout } from '@/domain/types';
import { normalizedStatsKey } from '@/domain/types';

export type TargetUnits = 'kg' | 'lbs';

/** What the plate or pin can actually add. */
export type LoadKind = 'bar' | 'dumbbell' | 'other';

type Step = { compound: number; isolation: number };

/**
 * Smallest sensible load step. `bar` is a barbell, EZ, trap, Smith or landmine bar: a
 * plate pair, whatever the lift. `other` is machines, cables, plates and added load on
 * bodyweight moves (and custom equipment).
 */
export const INCREMENTS: Record<TargetUnits, Record<LoadKind, Step>> = {
  kg: {
    bar: { compound: 2.5, isolation: 2.5 },
    dumbbell: { compound: 2, isolation: 2 },
    other: { compound: 2.5, isolation: 1 },
  },
  lbs: {
    bar: { compound: 5, isolation: 5 },
    dumbbell: { compound: 5, isolation: 5 },
    other: { compound: 5, isolation: 2.5 },
  },
};

/** Holds grow by this much per session. */
export const HOLD_STEP_SECONDS = 5;

/** Last session under this share of the one before counts as a regression or deload. */
export const REGRESSION_RATIO = 0.9;

export type SetTarget = {
  weight: number | null;
  counterweight: number | null;
  reps: number | null;
  durationSeconds: number | null;
  /**
   * `load`: the load moves (heavier, or less assistance). `reps`: same load, chase reps
   * or seconds. `hold`: repeat last time (regression, or nothing left to add).
   */
  step: 'load' | 'reps' | 'hold';
};

export type TargetPrescription = Pick<
  ExercisePrescription,
  | 'name'
  | 'sets'
  | 'reps'
  | 'repScheme'
  | 'trackingMode'
  | 'itemType'
  | 'equipments'
  | 'movementType'
  | 'bodyParts'
  | 'targetMuscles'
  | 'secondaryMuscles'
  | 'durationSeconds'
>;

export type TargetInput = {
  prescription: TargetPrescription;
  /** Sets from the most recent session of this exercise. */
  last: readonly LoggedSet[] | null | undefined;
  /** Sets from the session before that, for the regression check. */
  before?: readonly LoggedSet[] | null;
  units: TargetUnits;
};

type TargetMode = 'load' | 'assist' | 'reps' | 'hold';

/** How this exercise progresses, or null when it gets no target. */
export function targetMode(prescription: TargetPrescription): TargetMode | null {
  const { itemType, trackingMode } = prescription;
  if (
    itemType === 'cardio' ||
    itemType === 'stretch' ||
    itemType === 'timer' ||
    itemType === 'mobility' ||
    durationIsMinutes(prescription as ExercisePrescription)
  ) {
    return null;
  }
  switch (trackingMode) {
    case 'weightAndReps':
      return 'load';
    case 'counterweightAndReps':
      return 'assist';
    case 'reps':
    case 'repsAndDuration':
      return 'reps';
    case 'duration':
      return 'hold';
    default:
      return null;
  }
}

export function loadKind(equipments: readonly string[]): LoadKind {
  const equipment = (equipments[0] ?? '').toLowerCase();
  if (/\b(barbell|ez|trap bar|hex bar|smith|landmine|safety bar)\b/.test(equipment)) {
    return 'bar';
  }
  if (/dumbbell|kettlebell/.test(equipment)) {
    return 'dumbbell';
  }
  return 'other';
}

/** The load step for this exercise. Unknown size counts as isolation: the smaller step. */
export function loadIncrement(prescription: TargetPrescription, units: TargetUnits): number {
  const size = classifyExerciseSize({
    name: prescription.name,
    bodyParts: prescription.bodyParts,
    targetMuscles: prescription.targetMuscles,
    secondaryMuscles: prescription.secondaryMuscles,
    movementType: prescription.movementType,
  });
  const step = INCREMENTS[units][loadKind(prescription.equipments)];
  return size === 'large' ? step.compound : step.isolation;
}

function tidy(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Next point on the `increment` grid strictly above `load`: 85 → 87.5, 61 → 62.5. */
export function nextLoadUp(load: number, increment: number): number {
  const steps = Math.floor(tidy(load / increment) + 1e-9) + 1;
  return tidy(steps * increment);
}

/** Next point on the grid strictly below `load`; 0 or less means there is none. */
export function nextLoadDown(load: number, increment: number): number {
  const steps = Math.ceil(tidy(load / increment) - 1e-9) - 1;
  return tidy(steps * increment);
}

/** Last session's set at the same position, else its last set (today has more sets). */
function setAt(sets: readonly LoggedSet[], index: number): LoggedSet | null {
  return sets[Math.max(0, index)] ?? sets[sets.length - 1] ?? null;
}

function positive(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) && value > 0 ? value : null;
}

/** Did every working set reach the plan? Needs the plan's full set count logged. */
function hitEverySet(mode: TargetMode, prescription: TargetPrescription, last: readonly LoggedSet[]): boolean {
  const count = setCount(prescription as ExercisePrescription);
  if (last.length < count) {
    return false;
  }
  for (let index = 0; index < count; index += 1) {
    const set = last[index];
    if (!set) {
      return false;
    }
    if (mode === 'hold') {
      const goal = positive(prescription.durationSeconds);
      if (goal != null && (set.durationSeconds ?? 0) < goal) {
        return false;
      }
      continue;
    }
    const goal = repsForSet(prescription as ExercisePrescription, index);
    if (goal != null && (set.reps ?? 0) < goal) {
      return false;
    }
  }
  return true;
}

/** One number per session for the regression check: best 10RM, else total reps or seconds. */
function sessionScore(mode: TargetMode, sets: readonly LoggedSet[]): { kind: 'tenRM' | 'reps' | 'seconds'; value: number } {
  if (mode === 'hold') {
    return { kind: 'seconds', value: sets.reduce((sum, set) => sum + (set.durationSeconds ?? 0), 0) };
  }
  if (mode === 'load') {
    const best = sets.reduce((max, set) => Math.max(max, tenRMForSet(set) ?? 0), 0);
    if (best > 0) {
      return { kind: 'tenRM', value: best };
    }
  }
  return { kind: 'reps', value: sets.reduce((sum, set) => sum + (set.reps ?? 0), 0) };
}

/** Last session was clearly worse than the one before (a bad day or a deload). */
export function isRegression(
  mode: TargetMode,
  last: readonly LoggedSet[],
  before: readonly LoggedSet[] | null | undefined,
): boolean {
  if (!before || before.length === 0) {
    return false;
  }
  const now = sessionScore(mode, last);
  const then = sessionScore(mode, before);
  if (now.kind !== then.kind || then.value <= 0) {
    return false;
  }
  return now.value < then.value * REGRESSION_RATIO;
}

function repsTarget(lastReps: number, goal: number | null, progress: boolean): number {
  if (progress) {
    return lastReps + 1;
  }
  return goal == null ? lastReps + 1 : Math.min(lastReps + 1, goal);
}

function empty(step: SetTarget['step']): SetTarget {
  return { weight: null, counterweight: null, reps: null, durationSeconds: null, step };
}

/** Target for one set (0-based). Null when there is nothing to base it on. */
export function setTarget(input: TargetInput, index: number): SetTarget | null {
  const { prescription, last, before, units } = input;
  const mode = targetMode(prescription);
  if (!mode || !last || last.length === 0) {
    return null;
  }
  const previous = setAt(last, index);
  if (!previous) {
    return null;
  }
  const regressed = isRegression(mode, last, before);
  const progress = !regressed && hitEverySet(mode, prescription, last);
  const goal = repsForSet(prescription as ExercisePrescription, index);

  if (mode === 'hold') {
    const seconds = positive(previous.durationSeconds);
    if (seconds == null) {
      return null;
    }
    if (regressed) {
      return { ...empty('hold'), durationSeconds: seconds };
    }
    const planned = positive(prescription.durationSeconds);
    const next = progress || planned == null
      ? seconds + HOLD_STEP_SECONDS
      : Math.min(seconds + HOLD_STEP_SECONDS, planned);
    return { ...empty(next > seconds ? 'reps' : 'hold'), durationSeconds: next };
  }

  const lastReps = positive(previous.reps);
  const loadField = mode === 'assist' ? 'counterweight' : 'weight';
  const load = mode === 'reps' ? null : positive(previous[loadField]);

  // Bodyweight, or a load move logged without load: reps are the only lever.
  if (load == null) {
    if (lastReps == null) {
      return null;
    }
    if (regressed) {
      return { ...empty('hold'), reps: lastReps };
    }
    const reps = repsTarget(lastReps, goal, progress);
    return { ...empty(reps > lastReps ? 'reps' : 'hold'), reps };
  }

  const increment = loadIncrement(prescription, units);
  const withLoad = (value: number, reps: number | null, step: SetTarget['step']): SetTarget => ({
    ...empty(step),
    [loadField]: value,
    reps,
  });

  if (progress && goal != null) {
    if (mode === 'assist') {
      const lighter = nextLoadDown(load, increment);
      // At the lightest assistance: add a rep rather than suggest zero.
      return lighter > 0
        ? withLoad(lighter, goal, 'load')
        : withLoad(load, (lastReps ?? goal) + 1, 'reps');
    }
    return withLoad(nextLoadUp(load, increment), goal, 'load');
  }

  if (lastReps == null) {
    return withLoad(load, goal, 'hold');
  }
  if (regressed) {
    return withLoad(load, goal == null ? lastReps : Math.min(lastReps, goal), 'hold');
  }
  const reps = repsTarget(lastReps, goal, false);
  return withLoad(load, reps, reps > lastReps ? 'reps' : 'hold');
}

/**
 * Targets for today's sets (`count` defaults to the plan's set count). Null when no set
 * gets one: no history, or a tracking mode without targets.
 */
export function exerciseTargets(input: TargetInput, count?: number): (SetTarget | null)[] | null {
  const total = Math.max(1, count ?? setCount(input.prescription as ExercisePrescription));
  const targets = Array.from({ length: total }, (_, index) => setTarget(input, index));
  return targets.some((target) => target != null) ? targets : null;
}

/** Sets from the latest `limit` sessions of an exercise, newest first (history is newest first). */
export function recentSessionSets(
  history: readonly LoggedWorkout[],
  name: string,
  limit = 2,
): LoggedSet[][] {
  const key = normalizedStatsKey(name);
  const sessions: LoggedSet[][] = [];
  for (const workout of history) {
    const match = workout.exercises.find(
      (exercise) => normalizedStatsKey(exercise.exerciseName) === key && exercise.sets.length > 0,
    );
    if (match) {
      sessions.push(match.sets);
      if (sessions.length >= limit) {
        break;
      }
    }
  }
  return sessions;
}

/** Everything the log needs for one exercise, straight from history. */
export function targetsFromHistory(
  prescription: TargetPrescription,
  history: readonly LoggedWorkout[],
  units: TargetUnits,
  count?: number,
): (SetTarget | null)[] | null {
  const [last, before] = recentSessionSets(history, prescription.name, 2);
  return exerciseTargets({ prescription, last, before, units }, count);
}

// ---------------------------------------------------------------------------
// Words (VoiceOver) and compact text

function plural(count: number, one: string, many: string): string {
  return `${formatNumber(count)} ${count === 1 ? one : many}`;
}

function formatNumber(value: number): string {
  return String(tidy(value));
}

/**
 * A set in full words: `87.5 kilograms for 8 reps`, `20 kilograms of assistance for 8
 * reps`, `12 reps`, `50 seconds`. Null when the set has nothing to say.
 */
export function spokenSet(
  set: Pick<LoggedSet, 'weight' | 'counterweight' | 'reps' | 'durationSeconds'>,
  units: TargetUnits,
): string | null {
  const unitWords = units === 'kg' ? ['kilogram', 'kilograms'] : ['pound', 'pounds'];
  const reps = set.reps != null ? plural(set.reps, 'rep', 'reps') : null;
  const load =
    set.weight != null
      ? plural(set.weight, unitWords[0]!, unitWords[1]!)
      : set.counterweight != null
        ? `${plural(set.counterweight, unitWords[0]!, unitWords[1]!)} of assistance`
        : null;
  if (load && reps) {
    return `${load} for ${reps}`;
  }
  if (reps) {
    return reps;
  }
  if (set.durationSeconds != null) {
    return plural(set.durationSeconds, 'second', 'seconds');
  }
  return load;
}

/** `Target, 87.5 kilograms for 8 reps. Last time, 85 kilograms for 8 reps.` */
export function spokenTargetLine(
  target: SetTarget,
  lastTime: Pick<LoggedSet, 'weight' | 'counterweight' | 'reps' | 'durationSeconds'> | null,
  units: TargetUnits,
): string {
  const parts = [`Target, ${spokenSet(target, units) ?? 'none'}.`];
  const last = lastTime ? spokenSet(lastTime, units) : null;
  if (last) {
    parts.push(`Last time, ${last}.`);
  }
  return parts.join(' ');
}

/** Every set's target in words for the exercise sheet: collapses when they match. */
export function spokenTargets(targets: readonly (SetTarget | null)[], units: TargetUnits): string {
  const spoken = targets.map((target) => (target ? spokenSet(target, units) : null));
  const first = spoken[0];
  if (first && spoken.every((line) => line === first)) {
    return spoken.length === 1 ? first : `${first}, every set`;
  }
  return spoken
    .map((line, index) => `set ${index + 1}, ${line ?? 'no target'}`)
    .join('; ');
}
