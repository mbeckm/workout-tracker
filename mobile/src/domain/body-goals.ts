import {
  BODY_METRICS,
  bodyMetricForDisplay,
  bodyweightToKg,
  type BodyCheckIn,
  type BodyMetricKey,
  type WeightUnits,
} from '@/domain/check-in';
import { newId } from '@/domain/id';

/**
 * A body goal: a target for one body measurement (PRODUCT-DECISIONS 65). One per measurement.
 * `start` is the measurement when the goal was set, so the goal knows its direction: a target
 * under it is aimed down (a smaller waist), over it up (bigger arms). Values are stored like the
 * check-ins they compare with (bodyweight in kg, circumferences in cm). `reachedAt` is the
 * check-in that first met it, and Trim never clears it by itself.
 */
export type BodyGoal = {
  id: string;
  metric: BodyMetricKey;
  target: number;
  start: number;
  createdAt: string;
  reachedAt: string | null;
};

export type BodyGoalDirection = 'up' | 'down';

export function bodyGoalDirection(goal: Pick<BodyGoal, 'target' | 'start'>): BodyGoalDirection {
  return goal.target < goal.start ? 'down' : 'up';
}

/** The goal sheet's step: 1 kg or 2 lb for bodyweight, 1 cm for a circumference. */
export function bodyGoalStep(metric: BodyMetricKey, units: WeightUnits): number {
  return metric === 'bodyweightKg' && units === 'lbs' ? 2 : 1;
}

/** A goal's value in the unit the user reads. */
export function bodyGoalForDisplay(metric: BodyMetricKey, value: number, units: WeightUnits): number {
  return bodyMetricForDisplay(metric, value, units);
}

/** A typed value (the user's unit) in the stored unit. */
export function bodyGoalFromDisplay(metric: BodyMetricKey, value: number, units: WeightUnits): number {
  return metric === 'bodyweightKg' ? bodyweightToKg(value, units) : value;
}

export function bodyGoalFor(goals: readonly BodyGoal[], metric: BodyMetricKey): BodyGoal | null {
  return goals.find((goal) => goal.metric === metric) ?? null;
}

/** The latest stored value of a measurement, or null before any check-in has it. */
export function latestBodyValue(checkIns: readonly BodyCheckIn[], metric: BodyMetricKey): number | null {
  let latest: BodyCheckIn | null = null;
  for (const checkIn of checkIns) {
    if (checkIn[metric] != null && (!latest || checkIn.recordedAt > latest.recordedAt)) {
      latest = checkIn;
    }
  }
  return latest ? (latest[metric] as number) : null;
}

function meets(goal: BodyGoal, value: number): boolean {
  return bodyGoalDirection(goal) === 'down' ? value <= goal.target : value >= goal.target;
}

/** How far from `start` to `target` the measurement has come, 0 to 1. A reached goal is full. */
export function bodyGoalProgress(goal: BodyGoal, current: number | null): number {
  if (goal.reachedAt) {
    return 1;
  }
  if (current == null || goal.target === goal.start) {
    return 0;
  }
  return Math.max(0, Math.min(1, (current - goal.start) / (goal.target - goal.start)));
}

/** What's left, in the stored unit, never negative. */
export function bodyGoalRemaining(goal: BodyGoal, current: number | null): number | null {
  if (current == null) {
    return null;
  }
  return Math.max(0, bodyGoalDirection(goal) === 'down' ? current - goal.target : goal.target - current);
}

export type BodyGoalInput = {
  metric: BodyMetricKey;
  /** Stored unit. */
  target: number;
  /** The measurement now, stored unit: the goal's start. */
  start: number;
};

/**
 * Sets a measurement's goal: creates it, or changes the target of the one it has. A new target
 * is a new goal to reach, so `reachedAt` clears and it starts from where the measurement is now.
 */
export function withBodyGoal(goals: readonly BodyGoal[], input: BodyGoalInput, now = new Date()): BodyGoal[] {
  const existing = bodyGoalFor(goals, input.metric);
  if (existing) {
    if (existing.target === input.target) {
      return [...goals];
    }
    return goals.map((goal) =>
      goal.id === existing.id ? { ...goal, target: input.target, start: input.start, reachedAt: null } : goal,
    );
  }
  return [
    ...goals,
    {
      id: newId(),
      metric: input.metric,
      target: input.target,
      start: input.start,
      createdAt: now.toISOString(),
      reachedAt: null,
    },
  ];
}

/** Goals not reached yet that `checkIn` meets. */
export function bodyGoalsReachedBy(checkIn: BodyCheckIn, goals: readonly BodyGoal[]): BodyGoal[] {
  return goals.filter((goal) => {
    const value = checkIn[goal.metric];
    return !goal.reachedAt && value != null && meets(goal, value);
  });
}

/** Marks the goals a saved check-in reached. */
export function withReachedBodyGoals(goals: readonly BodyGoal[], checkIn: BodyCheckIn): BodyGoal[] {
  const reached = new Set(bodyGoalsReachedBy(checkIn, goals).map((goal) => goal.id));
  if (reached.size === 0) {
    return [...goals];
  }
  return goals.map((goal) => (reached.has(goal.id) ? { ...goal, reachedAt: checkIn.recordedAt } : goal));
}

export function normalizeBodyGoals(value: unknown): BodyGoal[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const goals: BodyGoal[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') {
      continue;
    }
    const goal = raw as Partial<BodyGoal>;
    if (
      typeof goal.id !== 'string' ||
      !BODY_METRICS.some((metric) => metric.key === goal.metric) ||
      typeof goal.target !== 'number' ||
      !Number.isFinite(goal.target) ||
      goal.target <= 0 ||
      typeof goal.start !== 'number' ||
      !Number.isFinite(goal.start)
    ) {
      continue;
    }
    // One goal per measurement: the first one wins.
    if (!goal.metric || bodyGoalFor(goals, goal.metric)) {
      continue;
    }
    goals.push({
      id: goal.id,
      metric: goal.metric,
      target: goal.target,
      start: goal.start,
      createdAt: typeof goal.createdAt === 'string' ? goal.createdAt : new Date(0).toISOString(),
      reachedAt: typeof goal.reachedAt === 'string' ? goal.reachedAt : null,
    });
  }
  return goals;
}
