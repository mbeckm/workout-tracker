import { formatDoneWhen } from '@/domain/day-facts';
import { exerciseTargets, recentSessionSets, type TargetPrescription, type TargetUnits } from '@/domain/targets';
import type { LoggedSet, LoggedWorkout } from '@/domain/types';
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
