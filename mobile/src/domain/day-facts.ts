import { durationIsMinutes, setCount, usesDuration, usesReps } from '@/domain/helpers';
import { restSecondsForExercise } from '@/domain/rest';
import type { ExercisePrescription, LoggedWorkout, WorkoutDay, WorkoutPlan } from '@/domain/types';

/** Seconds of work per strength set, before rest. */
const WORK_SECONDS_PER_SET = 40;

export function formatExerciseCount(count: number): string {
  return count === 1 ? '1 exercise' : `${count} exercises`;
}

/** Completed sessions of this plan day, newest first. */
function sessionsForDay(
  planId: string,
  dayId: string,
  history: LoggedWorkout[],
): LoggedWorkout[] {
  return history
    .filter(
      (workout) =>
        workout.dayId === dayId &&
        (workout.planId == null || workout.planId === planId) &&
        workout.setCount > 0,
    )
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}

export function lastDoneAt(
  plan: WorkoutPlan,
  dayId: string,
  history: LoggedWorkout[],
): string | null {
  return sessionsForDay(plan.id, dayId, history)[0]?.completedAt ?? null;
}

function exerciseSeconds(exercise: ExercisePrescription): number {
  if (durationIsMinutes(exercise)) {
    return Math.max(60, exercise.durationSeconds ?? 20 * 60);
  }
  const sets = setCount(exercise);
  const rest = restSecondsForExercise(exercise);
  const work =
    usesDuration(exercise.trackingMode) && !usesReps(exercise.trackingMode)
      ? (exercise.durationSeconds ?? 30)
      : WORK_SECONDS_PER_SET;
  // No rest after the last set.
  return sets * work + Math.max(0, sets - 1) * rest;
}

/**
 * Minutes this day usually takes: the median of the last three sessions when there are any,
 * otherwise sets × (work + rest) from the prescription. Null for an empty day.
 */
export function estimateDayMinutes(
  plan: WorkoutPlan,
  day: WorkoutDay,
  history: LoggedWorkout[],
): number | null {
  if (day.exercises.length === 0) {
    return null;
  }
  const recent = sessionsForDay(plan.id, day.id, history)
    .slice(0, 3)
    .map((workout) => workout.durationMinutes)
    .filter((minutes) => Number.isFinite(minutes) && minutes > 0)
    .sort((a, b) => a - b);
  if (recent.length > 0) {
    return Math.max(1, Math.round(recent[Math.floor(recent.length / 2)]));
  }
  const seconds = day.exercises.reduce((sum, exercise) => sum + exerciseSeconds(exercise), 0);
  // Round to 5 so the estimate doesn't pretend to be precise.
  return Math.max(5, Math.round(seconds / 60 / 5) * 5);
}

/** `Today`, `Yesterday`, `Thu 17` within four weeks, then `Aug 27` (plus year when needed). */
export function formatDoneWhen(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - that.getTime()) / 86_400_000);
  if (diffDays === 0) {
    return 'Today';
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  if (diffDays > 1 && diffDays < 28) {
    const weekday = date.toLocaleDateString(undefined, { weekday: 'short' });
    return `${weekday} ${date.getDate()}`;
  }
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** `18:02` or `6:02 PM`, following the device locale. */
export function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatLoggedSets(count: number): string {
  return count === 1 ? '1 set logged' : `${count} sets logged`;
}

/** `Done today`, `Done yesterday`, `Done Thu 17`. */
export function formatDoneLabel(iso: string, now = new Date()): string {
  const when = formatDoneWhen(iso, now);
  return when === 'Today' || when === 'Yesterday' ? `Done ${when.toLowerCase()}` : `Done ${when}`;
}
