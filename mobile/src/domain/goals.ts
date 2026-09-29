import { bestOneRMForExercise, liftSeriesFromHistory } from '@/domain/progress';
import { newId, normalizedStatsKey, type LoggedWorkout } from '@/domain/types';

/**
 * A goal: a target estimated 1RM for one lift (PRODUCT.md → Data model; PRODUCT-DECISIONS 62,
 * 63). Any number of lifts can have one, one per lift; up to `MAX_PINNED_GOALS` are pinned to
 * Progress. `target` is in the user's units, stored like every logged weight. `reachedAt` is
 * the finish time of the workout that first reached it, and Trim never clears it by itself.
 */
export type Goal = {
  id: string;
  exerciseName: string;
  target: number;
  pinned: boolean;
  createdAt: string;
  reachedAt: string | null;
};

export const MAX_PINNED_GOALS = 3;

type Units = 'kg' | 'lbs';

/** The goal sheet's step and the round numbers it suggests: 5 kg, or 10 lb. */
export function goalStep(units: Units): number {
  return units === 'lbs' ? 10 : 5;
}

/** The next round number above the current 1RM (`82` → `85`; `80` → `85`). */
export function suggestedGoalTarget(currentOneRM: number | null, units: Units): number {
  const step = goalStep(units);
  if (currentOneRM == null || currentOneRM <= 0) {
    return step * 10;
  }
  return Math.floor(currentOneRM / step) * step + step;
}

export function goalForLift(goals: readonly Goal[], exerciseName: string): Goal | null {
  const key = normalizedStatsKey(exerciseName);
  return goals.find((goal) => normalizedStatsKey(goal.exerciseName) === key) ?? null;
}

/** Progress's Goals section, oldest first (a goal keeps its place until it's unpinned). */
export function pinnedGoals(goals: readonly Goal[]): Goal[] {
  return goals
    .filter((goal) => goal.pinned)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

/** A lift's latest estimated 1RM (what lift detail's hero shows), or null before any set. */
export function currentOneRM(exerciseName: string, history: LoggedWorkout[]): number | null {
  const series = liftSeriesFromHistory(exerciseName, history);
  return series.length > 0 ? series[series.length - 1].oneRM : null;
}

/** How far along the track is, 0 to 1. A reached goal is full. */
export function goalProgress(goal: Goal, current: number | null): number {
  if (goal.reachedAt) {
    return 1;
  }
  if (current == null || goal.target <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, current / goal.target));
}

/** Goals not reached yet that `workout` reaches: a session's estimated 1RM ≥ the target. */
export function goalsReachedBy(workout: LoggedWorkout, goals: readonly Goal[]): Goal[] {
  return goals.filter((goal) => {
    if (goal.reachedAt) {
      return false;
    }
    const key = normalizedStatsKey(goal.exerciseName);
    return workout.exercises.some((exercise) => {
      if (normalizedStatsKey(exercise.exerciseName) !== key) {
        return false;
      }
      const oneRM = bestOneRMForExercise(exercise);
      return oneRM != null && oneRM >= goal.target;
    });
  });
}

/** The goals `workout` reached (Done's goal row, phase 4 of Progress v3). */
export function goalsReachedIn(workout: LoggedWorkout, goals: readonly Goal[]): Goal[] {
  return goals.filter((goal) => goal.reachedAt === workout.completedAt);
}

export type GoalInput = {
  exerciseName: string;
  target: number;
  /** Pin to Progress. Ignored when no slot is free, unless `replaceId` frees one. */
  pinned: boolean;
  /** With 3 pinned: the pinned goal this one takes the place of. */
  replaceId?: string | null;
};

/**
 * Sets a lift's goal: creates it, or changes the target of the one it has (a new target is a
 * new goal to reach, so `reachedAt` clears). A new goal pins itself while a slot is free.
 */
export function withGoal(goals: readonly Goal[], input: GoalInput, now = new Date()): Goal[] {
  const existing = goalForLift(goals, input.exerciseName);
  let next = goals.map((goal) =>
    input.replaceId && goal.id === input.replaceId ? { ...goal, pinned: false } : goal,
  );
  const pinnedElsewhere = next.filter((goal) => goal.pinned && goal.id !== existing?.id).length;
  const pinned = input.pinned && pinnedElsewhere < MAX_PINNED_GOALS;

  if (existing) {
    next = next.map((goal) =>
      goal.id === existing.id
        ? {
            ...goal,
            target: input.target,
            pinned,
            reachedAt: goal.target === input.target ? goal.reachedAt : null,
          }
        : goal,
    );
    return next;
  }
  return [
    ...next,
    {
      id: newId(),
      exerciseName: input.exerciseName,
      target: input.target,
      pinned,
      createdAt: now.toISOString(),
      reachedAt: null,
    },
  ];
}

/** Marks the goals a finished workout reached. */
export function withReachedGoals(goals: readonly Goal[], workout: LoggedWorkout): Goal[] {
  const reached = new Set(goalsReachedBy(workout, goals).map((goal) => goal.id));
  if (reached.size === 0) {
    return [...goals];
  }
  return goals.map((goal) => (reached.has(goal.id) ? { ...goal, reachedAt: workout.completedAt } : goal));
}

export function normalizeGoals(value: unknown): Goal[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const goals: Goal[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') {
      continue;
    }
    const goal = raw as Partial<Goal>;
    if (
      typeof goal.id !== 'string' ||
      typeof goal.exerciseName !== 'string' ||
      typeof goal.target !== 'number' ||
      !Number.isFinite(goal.target) ||
      goal.target <= 0
    ) {
      continue;
    }
    // One goal per lift: the first one wins.
    if (goalForLift(goals, goal.exerciseName)) {
      continue;
    }
    goals.push({
      id: goal.id,
      exerciseName: goal.exerciseName,
      target: goal.target,
      pinned: goal.pinned === true && goals.filter((item) => item.pinned).length < MAX_PINNED_GOALS,
      createdAt: typeof goal.createdAt === 'string' ? goal.createdAt : new Date(0).toISOString(),
      reachedAt: typeof goal.reachedAt === 'string' ? goal.reachedAt : null,
    });
  }
  return goals;
}
