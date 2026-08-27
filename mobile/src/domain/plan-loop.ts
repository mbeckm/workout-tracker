import type { LoggedWorkout, WorkoutPlan } from './types';

export type PlanDayStatus = 'completed' | 'next' | 'upcoming';

export type PlanLoopProgress = {
  completedDayIds: string[];
  nextDayIndex: number;
};

/**
 * A plan loop is one pass through every day. Calendar dates do not matter.
 * Completing the last remaining day starts the next loop immediately.
 */
export function planLoopProgress(
  plan: WorkoutPlan | null | undefined,
  history: LoggedWorkout[],
  fallbackNextDayIndex = 0,
): PlanLoopProgress {
  if (!plan || plan.days.length === 0) {
    return { completedDayIds: [], nextDayIndex: 0 };
  }

  const completed = new Set<string>();
  let sawPlanWorkout = false;

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const dayId = dayIdForPlanWorkout(history[index], plan);
    if (!dayId || completed.has(dayId)) {
      continue;
    }

    sawPlanWorkout = true;
    completed.add(dayId);
    if (trainableDays(plan).every((day) => completed.has(day.id))) {
      completed.clear();
    }
  }

  if (!sawPlanWorkout) {
    return {
      completedDayIds: [],
      nextDayIndex: nextTrainableIndex(plan, fallbackNextDayIndex),
    };
  }

  const nextDayIndex = plan.days.findIndex(
    (day) => day.exercises.length > 0 && !completed.has(day.id),
  );
  return {
    completedDayIds: [...completed],
    nextDayIndex: nextDayIndex === -1 ? nextTrainableIndex(plan, 0) : nextDayIndex,
  };
}

export function trainableDays(plan: WorkoutPlan): WorkoutPlan['days'] {
  return plan.days.filter((day) => day.exercises.length > 0);
}

export function nextTrainableIndex(plan: WorkoutPlan, startIndex = 0): number {
  const count = plan.days.length;
  if (count === 0) {
    return 0;
  }
  const start = clampDayIndex(startIndex, count);
  for (let offset = 0; offset < count; offset += 1) {
    const index = (start + offset) % count;
    if (plan.days[index].exercises.length > 0) {
      return index;
    }
  }
  return start;
}

export function planDayStatus(
  dayId: string,
  index: number,
  progress: PlanLoopProgress,
): PlanDayStatus {
  if (progress.completedDayIds.includes(dayId)) {
    return 'completed';
  }
  if (index === progress.nextDayIndex) {
    return 'next';
  }
  return 'upcoming';
}

/** Monday 00:00 in the local timezone. */
export function startOfLocalWeek(now = new Date()): Date {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekday = start.getDay();
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  start.setDate(start.getDate() - daysFromMonday);
  return start;
}

export function completedPlanDayIdsSince(
  plan: WorkoutPlan | null | undefined,
  history: LoggedWorkout[],
  since: Date,
): string[] {
  if (!plan) {
    return [];
  }

  const sinceMs = since.getTime();
  const completed: string[] = [];
  const seen = new Set<string>();

  for (const workout of history) {
    if (new Date(workout.completedAt).getTime() < sinceMs) {
      continue;
    }
    const dayId = dayIdForPlanWorkout(workout, plan);
    if (!dayId || seen.has(dayId)) {
      continue;
    }
    seen.add(dayId);
    completed.push(dayId);
  }

  return completed;
}

function dayIdForPlanWorkout(workout: LoggedWorkout, plan: WorkoutPlan): string | null {
  if (workout.setCount <= 0) {
    return null;
  }
  if (workout.planId && workout.planId !== plan.id) {
    return null;
  }
  if (workout.dayId && plan.days.some((day) => day.id === workout.dayId)) {
    return workout.dayId;
  }
  return null;
}

function clampDayIndex(index: number, dayCount: number): number {
  if (dayCount <= 0) {
    return 0;
  }
  return ((index % dayCount) + dayCount) % dayCount;
}
