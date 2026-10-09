/**
 * The roll call (decision 86): while the rocker moves, the display shows today's lifts as rows
 * and a frame steps to the new one, so you see which lift you're on and what the rocker did.
 * Pure TS, no `react-native`, so `scripts/check-device-logic.ts` can assert it with `tsx`.
 */
import type { DraftExercise } from '@/domain/log-session';
import type { ExercisePrescription } from '@/domain/types';

import { displayPrescription } from './home-model';
import type { LiftLampState } from './log/log-model';
import { tourLiftDone, type TourState } from './tour/tour-model';

export type RollRow = {
  key: string;
  /** Uppercase, as the display prints it. */
  name: string;
  /** Right lane: sets logged of planned (`1/3`), or the prescription in edit (`3×8`). */
  meta: string;
  /** Filled with ink and a ✓ instead of the meta. */
  done: boolean;
};

/** The open workout: sets logged of planned; a done lift is filled. */
export function sessionRollRows(drafts: readonly DraftExercise[], lamps: readonly LiftLampState[]): RollRow[] {
  return drafts.map((draft, index) => ({
    key: draft.prescription.id,
    name: draft.prescription.name.toUpperCase(),
    meta: `${draft.sets.filter((set) => set.done).length}/${draft.sets.length}`,
    done: lamps[index] === 'done',
  }));
}

/** A plan day in edit: each lift's prescription, nothing done. */
export function planRollRows(exercises: readonly ExercisePrescription[]): RollRow[] {
  return exercises.map((exercise) => ({
    key: exercise.id,
    name: exercise.name.toUpperCase(),
    meta: displayPrescription(exercise),
    done: false,
  }));
}

/** The tour's practice lifts: done only when their sets are, as the log's. */
export function tourRollRows(state: TourState): RollRow[] {
  return state.lifts.map((lift, index) => ({
    key: lift.id,
    name: lift.name.toUpperCase(),
    meta: `${state.sets[index] ?? 0}/${state.setsPerLift}`,
    done: tourLiftDone(state, index),
  }));
}

/**
 * The rows that show when only `fits` rows fit: all of them, else a window of `fits` with the
 * current row as near the middle as the ends allow. `end` is exclusive.
 */
export function rollWindow(count: number, index: number, fits: number): { start: number; end: number } {
  const room = Math.max(1, fits);
  if (count <= room) return { start: 0, end: count };
  const start = Math.min(Math.max(0, index - Math.floor(room / 2)), count - room);
  return { start, end: start + room };
}
