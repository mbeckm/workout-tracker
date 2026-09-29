import { formatDoneWhen } from '@/domain/day-facts';
import { personalBestCount } from '@/domain/helpers';
import { dayIdForPlanWorkout } from '@/domain/plan-loop';
import { workoutPersonalBests } from '@/domain/set-lines';
import { exerciseTargets, recentSessionSets, type TargetPrescription, type TargetUnits } from '@/domain/targets';
import type { LoggedSet, LoggedWorkout, WorkoutPlan } from '@/domain/types';
import { normalizedStatsKey } from '@/domain/types';

/**
 * One exercise's number on Home (the "Your numbers" Home): the load you'll work with today,
 * from your own history. Free users see last time's heaviest set; Pro users see the
 * next-session target, with how much it goes up.
 */
export type LiftNumber = {
  /** Today's working load: the Pro target, or last time's heaviest set. */
  load: number;
  /** Reps at that load: the target's, or last time's. */
  reps: number | null;
  /** The load goes up by this much (Pro, `load` step). Null when it holds. */
  loadUp: number | null;
  /** Same load, this many more reps (Pro, `reps` step). Null otherwise. */
  repsUp: number | null;
  /** When this exercise was last done. */
  lastAt: string;
};

function heaviest(sets: readonly LoggedSet[]): LoggedSet | null {
  let best: LoggedSet | null = null;
  for (const set of sets) {
    if (set.weight != null && set.weight > 0 && (best?.weight == null || set.weight > best.weight)) {
      best = set;
    }
  }
  return best;
}

function lastDoneAtFor(history: readonly LoggedWorkout[], name: string): string | null {
  const key = normalizedStatsKey(name);
  for (const workout of history) {
    if (
      workout.exercises.some(
        (exercise) => normalizedStatsKey(exercise.exerciseName) === key && exercise.sets.length > 0,
      )
    ) {
      return workout.completedAt;
    }
  }
  return null;
}

/** Tidy float steps (2.5 + 0.1 noise) for display: at most two decimals. */
function tidy(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The number for one exercise, or null when there's nothing weighted to show: no history,
 * bodyweight, or timed work. History is newest first.
 */
export function liftNumber(
  prescription: TargetPrescription,
  history: readonly LoggedWorkout[],
  units: TargetUnits,
  withTargets: boolean,
): LiftNumber | null {
  const [last, before] = recentSessionSets(history, prescription.name, 2);
  const top = last ? heaviest(last) : null;
  const lastAt = lastDoneAtFor(history, prescription.name);
  if (!last || !top?.weight || !lastAt) {
    return null;
  }
  const fromHistory: LiftNumber = {
    load: top.weight,
    reps: top.reps ?? null,
    loadUp: null,
    repsUp: null,
    lastAt,
  };
  if (!withTargets) {
    return fromHistory;
  }
  const targets = exerciseTargets({ prescription, last, before, units });
  if (!targets) {
    return fromHistory;
  }
  // The top target: the heaviest set Trim proposes today.
  let target = null as (typeof targets)[number];
  for (const candidate of targets) {
    if (candidate?.weight != null && (target?.weight == null || candidate.weight > target.weight)) {
      target = candidate;
    }
  }
  if (target?.weight == null) {
    return fromHistory;
  }
  if (target.step === 'load' && target.weight > top.weight) {
    return {
      load: target.weight,
      reps: target.reps,
      loadUp: tidy(target.weight - top.weight),
      repsUp: null,
      lastAt,
    };
  }
  if (target.step === 'reps' && target.reps != null && top.reps != null && target.reps > top.reps) {
    return { load: target.weight, reps: target.reps, loadUp: null, repsUp: target.reps - top.reps, lastAt };
  }
  return fromHistory;
}

/** `Thu 17`, `yesterday`, `today`: a date that sits mid-sentence. */
export function formatWhenInline(iso: string, now = new Date()): string {
  const when = formatDoneWhen(iso, now);
  return when === 'Today' || when === 'Yesterday' ? when.toLowerCase() : when;
}

/** `Last time Thu 17, 48 min`: the day's last session, as one fact. */
export function formatLastSession(workout: Pick<LoggedWorkout, 'completedAt' | 'durationMinutes'>, now = new Date()): string {
  const when = formatWhenInline(workout.completedAt, now);
  const minutes = Math.round(workout.durationMinutes);
  return minutes > 0 ? `Last time ${when}, ${minutes} min` : `Last time ${when}`;
}

/** One weekday of the current week: whether a workout was finished on it. */
export type WeekDayMark = { date: Date; done: boolean; isToday: boolean; isFuture: boolean };

/** Monday to Sunday of the week that starts at `weekStart`, each marked done or not. */
export function weekDayMarks(
  history: readonly LoggedWorkout[],
  weekStart: Date,
  now = new Date(),
): WeekDayMark[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + index);
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    const done = history.some((workout) => {
      if (workout.setCount <= 0) {
        return false;
      }
      const at = new Date(workout.completedAt).getTime();
      return at >= date.getTime() && at < next.getTime();
    });
    return { date, done, isToday: date.getTime() === today, isFuture: date.getTime() > today };
  });
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * The workout of this plan finished today, newest first, or null (Home's "Just trained"
 * state, trim-ui §13 Home states). History is newest first.
 */
export function workoutFinishedToday(
  plan: WorkoutPlan | null | undefined,
  history: readonly LoggedWorkout[],
  now = new Date(),
): LoggedWorkout | null {
  if (!plan) {
    return null;
  }
  const today = startOfDay(now);
  for (const workout of history) {
    if (new Date(workout.completedAt).getTime() < today) {
      return null;
    }
    if (dayIdForPlanWorkout(workout, plan)) {
      return workout;
    }
  }
  return null;
}

/**
 * What one lift did in a finished workout, against the session before it: its heaviest set
 * went up, held or went down by `delta`, or it's the first time (`load` alone). `record` when
 * the workout set a personal best on it (the crown replaces the ↑).
 */
export type LiftChange = {
  kind: 'up' | 'same' | 'down' | 'first';
  /** The heaviest set today. */
  load: number;
  /** Absolute change of the heaviest set, 0 for `same` and `first`. */
  delta: number;
  record: boolean;
};

/** Per exercise name (stats key) of `workout`: how its heaviest set changed. */
export function liftChanges(
  workout: LoggedWorkout,
  history: readonly LoggedWorkout[],
): Map<string, LiftChange> {
  const index = history.findIndex((item) => item.id === workout.id);
  const older = index === -1 ? history : history.slice(index + 1);
  const records = workoutPersonalBests(workout, [...history]).exerciseIds;
  const changes = new Map<string, LiftChange>();
  for (const exercise of workout.exercises) {
    const top = heaviest(exercise.sets);
    if (top?.weight == null) {
      continue;
    }
    const [previous] = recentSessionSets(older, exercise.exerciseName, 1);
    const before = previous ? heaviest(previous) : null;
    const record = records.has(exercise.id);
    const key = normalizedStatsKey(exercise.exerciseName);
    if (before?.weight == null) {
      changes.set(key, { kind: 'first', load: top.weight, delta: 0, record });
      continue;
    }
    const delta = tidy(top.weight - before.weight);
    changes.set(key, {
      kind: delta > 0 ? 'up' : delta < 0 ? 'down' : 'same',
      load: top.weight,
      delta: Math.abs(delta),
      record,
    });
  }
  return changes;
}

/** Looks up an exercise's change by name, the way history matches exercises. */
export function liftChangeFor(changes: Map<string, LiftChange>, name: string): LiftChange | null {
  return changes.get(normalizedStatsKey(name)) ?? null;
}

/**
 * This week in numbers, for a complete week (`↑ 9 lifts went up`, 👑 `2 new records`): lifts
 * whose heaviest set this week beats their last session before it, and the personal bests set
 * this week.
 */
export function weekLiftSummary(
  history: readonly LoggedWorkout[],
  weekStart: Date,
): { liftsUp: number; records: number } {
  const since = weekStart.getTime();
  const thisWeek = history.filter(
    (workout) => workout.setCount > 0 && new Date(workout.completedAt).getTime() >= since,
  );
  const before = history.filter((workout) => new Date(workout.completedAt).getTime() < since);
  const best = new Map<string, { name: string; weight: number }>();
  for (const workout of thisWeek) {
    for (const exercise of workout.exercises) {
      const top = heaviest(exercise.sets);
      if (top?.weight == null) {
        continue;
      }
      const key = normalizedStatsKey(exercise.exerciseName);
      const current = best.get(key);
      if (!current || top.weight > current.weight) {
        best.set(key, { name: exercise.exerciseName, weight: top.weight });
      }
    }
  }
  let liftsUp = 0;
  for (const { name, weight } of best.values()) {
    const [previous] = recentSessionSets(before, name, 1);
    const previousTop = previous ? heaviest(previous) : null;
    if (previousTop?.weight != null && weight > previousTop.weight) {
      liftsUp += 1;
    }
  }
  const records = thisWeek.reduce(
    (sum, workout) => sum + personalBestCount(workout, [...history]),
    0,
  );
  return { liftsUp, records };
}
