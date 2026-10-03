import { useCallback, useEffect, useRef } from 'react';

import { useDevice } from '@/device/device-context';
import { editFace, liftAfterRemoval, stepSets, stepValue, withExercise, type EditFace } from '@/device/edit-model';
import { dayDisplayName, planDisplayName } from '@/device/plans-model';
import type { ExercisePrescription, WorkoutDay, WorkoutPlan } from '@/domain/types';
import { useUndoableDeletes } from '@/store/undoable-deletes';
import { useWorkoutStore } from '@/store/workout-store';

export type EditController = {
  plan: WorkoutPlan;
  day: WorkoutDay;
  dayName: string;
  planName: string;
  exercise: ExercisePrescription;
  index: number;
  count: number;
  face: EditFace;
  /** `+` / `−`: one set more or fewer; false at 1 / 10 (no haptic, nothing saved). */
  stepSets: (delta: 1 | -1) => boolean;
  /** A wheel notch: a rep, 5 s or a minute; false at a limit. */
  stepValue: (delta: 1 | -1) => boolean;
  prev: () => void;
  next: () => void;
  /** ✕: the lift goes (Undo toast); the next one shows, or the editor comes back when it was the last. */
  remove: () => void;
  /** Done, ‹ and the rocker's middle. */
  back: () => void;
  /** The display's VoiceOver summary (PLAN §7). */
  summary: string;
};

/**
 * Device edit (PA2, PLAN Phase 6.3): the lift `useDevice().state.edit` points at, and what the
 * keys, the wheel and the rocker do to it. Every change saves straight to the plan
 * (`editPlan`, the store's functional `updatePlan`), as the editor does. Returns null outside
 * edit. When the lift or its day goes away underneath (Undo, a delete), it moves to the lift in
 * its place, or back to the editor.
 */
export function useEditDevice(): EditController | null {
  const { state, editLift, leaveEdit } = useDevice();
  const { plans, editPlan } = useWorkoutStore();
  const { removeExercise } = useUndoableDeletes();
  const target = state.uiMode === 'edit' ? state.edit : null;

  const plan = target ? plans.find((item) => item.id === target.planId) : undefined;
  const dayIndex = plan && target ? plan.days.findIndex((item) => item.id === target.dayId) : -1;
  const day = plan?.days[dayIndex];
  const index = day && target ? day.exercises.findIndex((item) => item.id === target.exerciseId) : -1;
  const exercise = day?.exercises[index];

  // The last place the lift sat, so a vanished lift is replaced by its neighbour.
  const lastIndex = useRef(0);
  useEffect(() => {
    if (index >= 0) lastIndex.current = index;
  }, [index]);

  useEffect(() => {
    if (!target || exercise) return;
    if (!day || day.exercises.length === 0) {
      leaveEdit();
      return;
    }
    editLift(day.exercises[Math.min(lastIndex.current, day.exercises.length - 1)].id);
  }, [target, exercise, day, leaveEdit, editLift]);

  // ‹ › step from the lift the last press chose, not the last render: quick presses each move one.
  const liveIndex = useRef(index);
  useEffect(() => {
    liveIndex.current = index;
  }, [index]);

  // Steps read the latest value, not the last render: fast taps and spins don't drop a step.
  const live = useRef<ExercisePrescription | null>(exercise ?? null);
  useEffect(() => {
    live.current = exercise ?? null;
  }, [exercise]);

  const save = useCallback(
    (step: (current: ExercisePrescription) => ExercisePrescription | null): boolean => {
      const current = live.current;
      if (!current || !target) return false;
      const next = step(current);
      if (!next) return false;
      live.current = next;
      editPlan(target.planId, (latest) => withExercise(latest, target.dayId, next));
      return true;
    },
    [editPlan, target],
  );

  const stepSetsBy = useCallback((delta: 1 | -1) => save((current) => stepSets(current, delta)), [save]);
  const stepValueBy = useCallback((delta: 1 | -1) => save((current) => stepValue(current, delta)), [save]);

  if (!target || !plan || !day || !exercise) {
    return null;
  }

  const face = editFace(exercise);
  const go = (delta: 1 | -1) => {
    const to = liveIndex.current + delta;
    const lift = day.exercises[to];
    if (!lift) return;
    liveIndex.current = to;
    editLift(lift.id);
  };
  const dayName = dayDisplayName(day, dayIndex);

  return {
    plan,
    day,
    dayName,
    planName: planDisplayName(plan),
    exercise,
    index,
    count: day.exercises.length,
    face,
    stepSets: stepSetsBy,
    stepValue: stepValueBy,
    prev: () => go(-1),
    next: () => go(1),
    remove: () => {
      const after = liftAfterRemoval(day.exercises, exercise.id);
      removeExercise(plan, day.id, exercise.id);
      if (after) {
        editLift(after);
      } else {
        leaveEdit();
      }
    },
    back: leaveEdit,
    summary: `${exercise.name}, ${face.spoken}. ${dayName}, lift ${index + 1} of ${day.exercises.length}`,
  };
}
