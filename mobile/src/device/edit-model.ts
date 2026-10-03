/**
 * Device edit (PA2, screen 22; PLAN Phase 6.3, SPEC §5 Edit): one lift's sets × reps on the
 * device. The tall keys step sets (1–10); the wheel steps reps (1–50), or seconds in 5 s steps
 * for holds (`SETS × 0:45`), or minutes for minute cardio (`SETS × 20 MIN`). Pure TS, no
 * `react-native`, so `scripts/check-plans-logic.ts` can assert it with `tsx`.
 *
 * The values a step writes come from `prescriptionFields` (the old day editor's patches: sets
 * clear a rep scheme and keep interval rounds in step).
 */
import { durationIsMinutes, setCount, usesDuration, usesReps } from '@/domain/helpers';
import { prescriptionFields } from '@/domain/prescription-fields';
import type { ExercisePrescription, WorkoutPlan } from '@/domain/types';

/** What the wheel steps. */
export type EditKind = 'reps' | 'seconds' | 'minutes';

export const EDIT_LIMITS = {
  sets: { min: 1, max: 10, step: 1 },
  reps: { min: 1, max: 50, step: 1 },
  seconds: { min: 5, max: 600, step: 5 },
  minutes: { min: 1, max: 240, step: 1 },
} as const;

export function editKind(exercise: ExercisePrescription): EditKind {
  if (durationIsMinutes(exercise)) return 'minutes';
  if (usesDuration(exercise.trackingMode) && !usesReps(exercise.trackingMode)) return 'seconds';
  return 'reps';
}

/** The wheel's value: reps, seconds or minutes (with the editor's defaults). */
export function editValue(exercise: ExercisePrescription): number {
  switch (editKind(exercise)) {
    case 'minutes':
      return Math.max(1, Math.round((exercise.durationSeconds ?? 0) / 60) || 20);
    case 'seconds':
      return exercise.durationSeconds ?? 30;
    default:
      return Math.max(1, exercise.reps || 8);
  }
}

function clock(seconds: number): string {
  const value = Math.max(0, Math.round(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function spokenDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  const parts: string[] = [];
  if (minutes > 0) parts.push(plural(minutes, 'minute', 'minutes'));
  if (rest > 0 || minutes === 0) parts.push(plural(rest, 'second', 'seconds'));
  return parts.join(' ');
}

export type EditFace = {
  kind: EditKind;
  sets: number;
  value: number;
  setsText: string;
  /** The framed number: `12`, `0:45`, `20`. */
  valueText: string;
  /** Over the framed number: `REPS`, `TIME`, `MIN`. */
  valueLabel: string;
  /** Engraved under the wheel. */
  wheelLabel: string;
  /** The footer's right fact: `36 REPS`, `2:15`, `60 MIN`. */
  total: string;
  /** VoiceOver: `3 sets of 12 reps`. */
  spoken: string;
  /** The wheel's VoiceOver value: `12 reps`, `45 seconds`, `20 minutes`. */
  spokenValue: string;
};

export function editFace(exercise: ExercisePrescription): EditFace {
  const kind = editKind(exercise);
  const sets = setCount(exercise);
  const value = editValue(exercise);
  const setsSpoken = plural(sets, 'set', 'sets');
  switch (kind) {
    case 'seconds':
      return {
        kind,
        sets,
        value,
        setsText: String(sets),
        valueText: clock(value),
        valueLabel: 'TIME',
        wheelLabel: 'TIME',
        total: clock(sets * value),
        spoken: `${setsSpoken} of ${spokenDuration(value)}`,
        spokenValue: spokenDuration(value),
      };
    case 'minutes':
      return {
        kind,
        sets,
        value,
        setsText: String(sets),
        valueText: String(value),
        valueLabel: 'MIN',
        wheelLabel: 'TIME',
        total: `${sets * value} MIN`,
        spoken: `${setsSpoken} of ${plural(value, 'minute', 'minutes')}`,
        spokenValue: plural(value, 'minute', 'minutes'),
      };
    default:
      return {
        kind,
        sets,
        value,
        setsText: String(sets),
        valueText: String(value),
        valueLabel: 'REPS',
        wheelLabel: 'REPS',
        total: `${sets * value} REPS`,
        spoken: `${setsSpoken} of ${plural(value, 'rep', 'reps')}`,
        spokenValue: plural(value, 'rep', 'reps'),
      };
  }
}

/**
 * One step from `current` in `delta`'s direction on a `step` grid, inside [min, max]; null at
 * a limit. A value off the grid (42 s) snaps to it (45 up, 40 down); one above the limit (12
 * sets from an old plan) can still come down one at a time.
 */
export function stepWithin(
  current: number,
  delta: 1 | -1,
  limits: { min: number; max: number; step: number },
): number | null {
  if (delta > 0 ? current >= limits.max : current <= limits.min) return null;
  const next =
    delta > 0
      ? Math.floor(current / limits.step) * limits.step + limits.step
      : Math.ceil(current / limits.step) * limits.step - limits.step;
  return delta > 0 ? Math.min(next, limits.max) : Math.max(next, limits.min);
}

function patchFor(exercise: ExercisePrescription, key: 'sets' | EditKind, value: number): ExercisePrescription {
  const field = prescriptionFields(exercise).find((item) => item.key === key);
  if (field) {
    return { ...exercise, ...field.patch(value) };
  }
  // Minute cardio has no sets field in the old editor; the device still sets its sets.
  return key === 'sets' ? { ...exercise, sets: value, repScheme: null } : exercise;
}

/** The `+` / `−` keys: one set more or fewer, or null at 1 / 10. */
export function stepSets(exercise: ExercisePrescription, delta: 1 | -1): ExercisePrescription | null {
  const next = stepWithin(setCount(exercise), delta, EDIT_LIMITS.sets);
  return next == null ? null : patchFor(exercise, 'sets', next);
}

/** One wheel notch: a rep, 5 seconds or a minute; null at a limit. */
export function stepValue(exercise: ExercisePrescription, delta: 1 | -1): ExercisePrescription | null {
  const kind = editKind(exercise);
  const next = stepWithin(editValue(exercise), delta, EDIT_LIMITS[kind]);
  return next == null ? null : patchFor(exercise, kind, next);
}

/** The plan with one lift replaced (by id, in its day). Unchanged when it isn't there. */
export function withExercise(plan: WorkoutPlan, dayId: string, exercise: ExercisePrescription): WorkoutPlan {
  const day = plan.days.find((item) => item.id === dayId);
  if (!day || !day.exercises.some((item) => item.id === exercise.id)) return plan;
  return {
    ...plan,
    days: plan.days.map((item) =>
      item.id === dayId
        ? { ...item, exercises: item.exercises.map((row) => (row.id === exercise.id ? exercise : row)) }
        : item,
    ),
  };
}

/** Where edit goes after a lift is removed: the lift now in its place (or the new last), or null when the day is empty. */
export function liftAfterRemoval(exercises: readonly ExercisePrescription[], removedId: string): string | null {
  const index = exercises.findIndex((item) => item.id === removedId);
  const rest = exercises.filter((item) => item.id !== removedId);
  if (rest.length === 0) return null;
  return rest[Math.min(Math.max(index, 0), rest.length - 1)].id;
}
