import {
  bodyMetricForDisplay,
  type BodyMetricKey,
  type BodyCheckIn,
  type WeightUnits,
} from '@/domain/check-in';
import { estimatedOneRM, formatLoggedSetLine } from '@/domain/helpers';
import type { LoggedExercise, LoggedSet, LoggedWorkout, WorkoutPlan } from '@/domain/types';
import { normalizedStatsKey } from '@/domain/types';

export type ProgressWindow = '3M' | '6M' | 'YTD' | 'All';

export const PROGRESS_WINDOWS: ProgressWindow[] = ['3M', '6M', 'YTD', 'All'];

/**
 * Pro boundary: free keeps the recent view (3M, about 90 days); Trim Pro unlocks the long
 * view. YTD is Pro too, because from spring on it reaches further back than 3M.
 * `isProgressWindowLocked` feeds `WindowChips.locked` on lift and body detail.
 */
export const FREE_PROGRESS_WINDOWS: readonly ProgressWindow[] = ['3M'];

export function isProgressWindowLocked(window: ProgressWindow, isPro: boolean): boolean {
  return !isPro && !FREE_PROGRESS_WINDOWS.includes(window);
}

/** Default chip: the widest window the user can open, capped at 6M. */
export function defaultProgressWindow(isPro: boolean): ProgressWindow {
  return isPro ? '6M' : '3M';
}

export type ProgressPoint = {
  date: string;
  value: number;
};

export type LiftSessionPoint = {
  date: string;
  workoutId: string;
  sets: LoggedSet[];
  oneRM: number;
  bestSet: LoggedSet;
};

export type TrackedLift = {
  name: string;
  latestOneRM: number | null;
  sparkline: number[];
  /** Best set of the latest session (`85 × 8`), not an e1RM: it reads as what was lifted. */
  indexValue: string;
  /** VoiceOver phrasing of `indexValue`. */
  spokenValue: string;
};

function isAddedWeightLift(name: string): boolean {
  const key = normalizedStatsKey(name);
  if (key.includes('pulldown') || key.includes('face pull') || key.includes('lat pull')) {
    return false;
  }
  return (
    key.includes('pull-up') ||
    key.includes('pull up') ||
    key.includes('chin-up') ||
    key.includes('chin up') ||
    key === 'dip' ||
    key === 'dips' ||
    key.endsWith(' dip')
  );
}

function formatAddedWeightIndex(weight: number, units: 'kg' | 'lbs'): string {
  const rounded = Math.round(weight * 10) / 10;
  const text = Number.isInteger(rounded) ? String(Math.round(rounded)) : rounded.toFixed(1);
  return `+${text} ${units}`;
}

function liftIndexPresentation(
  name: string,
  history: LoggedWorkout[],
  units: 'kg' | 'lbs',
  sparklineWindow: ProgressWindow | null,
): { indexValue: string; spokenValue: string; sparkline: number[]; latestOneRM: number | null } {
  const series = liftSeriesFromHistory(name, history);
  // The sparkline never reaches further back than the detail screen can open.
  const sparkSeries =
    sparklineWindow == null
      ? series
      : series.filter((point) => isInProgressWindow(point.date, sparklineWindow));

  if (isAddedWeightLift(name)) {
    const weights = series.map((point) => point.bestSet.weight).filter((value) => value != null);
    const latestWeight = weights.length > 0 ? weights[weights.length - 1]! : null;
    const indexValue = latestWeight != null ? formatAddedWeightIndex(latestWeight, units) : '—';
    return {
      indexValue,
      spokenValue: latestWeight != null ? `plus ${latestWeight} ${units}` : 'no sets yet',
      sparkline: sparkSeries
        .map((point) => point.bestSet.weight)
        .filter((value) => value != null)
        .slice(-8),
      latestOneRM: null,
    };
  }

  const latest = series.length > 0 ? series[series.length - 1] : null;
  return {
    indexValue: latest ? formatLoggedSetLine(latest.bestSet, { unit: units }) : '—',
    spokenValue: latest
      ? `best set ${latest.bestSet.weight} ${units} for ${latest.bestSet.reps} reps`
      : 'no sets yet',
    sparkline: sparkSeries.slice(-8).map((point) => point.oneRM),
    latestOneRM: latest?.oneRM ?? null,
  };
}

function setHasWeightAndReps(set: LoggedSet): boolean {
  return set.weight != null && set.reps != null && set.weight > 0 && set.reps > 0;
}

function bestWeightedSet(sets: LoggedSet[]): LoggedSet | null {
  let best: LoggedSet | null = null;
  let bestValue = -Infinity;

  for (const set of sets) {
    if (!setHasWeightAndReps(set)) {
      continue;
    }
    const value = estimatedOneRM(set.weight, set.reps);
    if (value != null && value > bestValue) {
      bestValue = value;
      best = set;
    }
  }

  return best;
}

export function bestOneRMForExercise(exercise: LoggedExercise): number | null {
  const best = bestWeightedSet(exercise.sets);
  if (!best) {
    return null;
  }
  return estimatedOneRM(best.weight, best.reps);
}

export function liftSeriesFromHistory(
  exerciseName: string,
  history: LoggedWorkout[],
): LiftSessionPoint[] {
  const key = normalizedStatsKey(exerciseName);
  const points: LiftSessionPoint[] = [];

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const workout = history[index];
    const match = workout.exercises.find(
      (exercise) => normalizedStatsKey(exercise.exerciseName) === key,
    );
    if (!match) {
      continue;
    }

    const bestSet = bestWeightedSet(match.sets);
    if (!bestSet) {
      continue;
    }

    const oneRM = estimatedOneRM(bestSet.weight, bestSet.reps);
    if (oneRM == null) {
      continue;
    }

    points.push({
      date: workout.completedAt,
      workoutId: workout.id,
      sets: match.sets.filter(setHasWeightAndReps),
      oneRM,
      bestSet,
    });
  }

  return points;
}

function windowStart(window: ProgressWindow, now = new Date()): Date | null {
  if (window === 'All') {
    return null;
  }

  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (window === 'YTD') {
    return new Date(now.getFullYear(), 0, 1);
  }

  const months = window === '3M' ? 3 : 6;
  start.setMonth(start.getMonth() - months);
  return start;
}

/** True when `dateIso` falls inside `window` (same bounds as `filterPointsByWindow`). */
export function isInProgressWindow(
  dateIso: string,
  window: ProgressWindow,
  now = new Date(),
): boolean {
  const start = windowStart(window, now);
  return start == null || new Date(dateIso).getTime() >= start.getTime();
}

export function filterPointsByWindow(
  points: ProgressPoint[],
  window: ProgressWindow,
  now = new Date(),
): ProgressPoint[] {
  const start = windowStart(window, now);
  if (!start) {
    return [...points];
  }

  const startMs = start.getTime();
  return points.filter((point) => new Date(point.date).getTime() >= startMs);
}

export function windowPercentChange(
  points: ProgressPoint[],
  window: ProgressWindow,
  now = new Date(),
): number | null {
  const filtered = filterPointsByWindow(points, window, now);
  if (filtered.length < 2) {
    return null;
  }

  return percentFromWindowStart(filtered, filtered[filtered.length - 1].value);
}

/** % change from the first point in `windowPoints` to `value` (for scrubbed hero). */
export function percentFromWindowStart(
  windowPoints: ProgressPoint[],
  value: number,
): number | null {
  if (windowPoints.length < 2) {
    return null;
  }

  const first = windowPoints[0].value;
  if (first === 0 || !Number.isFinite(value)) {
    return null;
  }

  return ((value - first) / first) * 100;
}

export function formatProgressWeight(value: number, units: 'kg' | 'lbs'): string {
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(Math.round(rounded)) : rounded.toFixed(1);
  return `${text} ${units}`;
}

/** Paper Progress shows whole-kg e1RM (94 kg), not one-decimal Epley. */
export function formatProgressOneRM(value: number, units: 'kg' | 'lbs'): string {
  return `${Math.round(value)} ${units}`;
}

export function formatProgressDelta(percent: number | null): string {
  if (percent == null || !Number.isFinite(percent)) {
    return '—';
  }

  const rounded = Math.round(percent);
  if (rounded === 0) {
    return '0%';
  }

  return rounded > 0 ? `+${rounded}%` : `${rounded}%`;
}

function exerciseNamesFromHistory(history: LoggedWorkout[]): Map<string, string> {
  const names = new Map<string, string>();

  for (const workout of history) {
    for (const exercise of workout.exercises) {
      const key = normalizedStatsKey(exercise.exerciseName);
      if (names.has(key)) {
        continue;
      }
      if (exercise.sets.some(setHasWeightAndReps)) {
        names.set(key, exercise.exerciseName);
      }
    }
  }

  return names;
}

function planExerciseOrder(plan: WorkoutPlan | null | undefined): string[] {
  if (!plan) {
    return [];
  }

  const order: string[] = [];
  const seen = new Set<string>();

  for (const day of plan.days) {
    for (const exercise of day.exercises) {
      const key = normalizedStatsKey(exercise.name);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      order.push(key);
    }
  }

  return order;
}

/**
 * `sparklineWindow` clamps each row's sparkline to a window (free users: 3M). The index value
 * stays the latest best set, which the log screen already shows as last time.
 */
export function collectTrackedLifts(
  history: LoggedWorkout[],
  activePlan?: WorkoutPlan | null,
  units: 'kg' | 'lbs' = 'kg',
  sparklineWindow: ProgressWindow | null = null,
): TrackedLift[] {
  const names = exerciseNamesFromHistory(history);
  const planOrder = planExerciseOrder(activePlan);
  const planRank = new Map(planOrder.map((key, index) => [key, index]));

  const lifts = [...names.entries()].map(([key, name]) => {
    const presentation = liftIndexPresentation(name, history, units, sparklineWindow);

    return { key, name, ...presentation };
  });

  lifts.sort((left, right) => {
    const leftRank = planRank.get(left.key);
    const rightRank = planRank.get(right.key);

    if (leftRank != null && rightRank != null) {
      return leftRank - rightRank;
    }
    if (leftRank != null) {
      return -1;
    }
    if (rightRank != null) {
      return 1;
    }
    return left.name.localeCompare(right.name);
  });

  return lifts.map(({ name, latestOneRM, sparkline, indexValue, spokenValue }) => ({
    name,
    latestOneRM,
    sparkline,
    indexValue,
    spokenValue,
  }));
}

/** Values come back in the user's units (bodyweight is stored in kg). */
export function bodyMetricSeries(
  checkIns: BodyCheckIn[],
  key: BodyMetricKey,
  units: WeightUnits = 'kg',
): ProgressPoint[] {
  return [...checkIns]
    .filter((checkIn) => checkIn[key] != null)
    .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt))
    .map((checkIn) => ({
      date: checkIn.recordedAt,
      value: bodyMetricForDisplay(key, checkIn[key] as number, units),
    }));
}

export function latestCheckIn(checkIns: BodyCheckIn[]): BodyCheckIn | null {
  if (checkIns.length === 0) {
    return null;
  }

  return [...checkIns].sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))[0];
}

export function formatCheckInDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatProgressShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function isSessionPR(
  exerciseName: string,
  sessionOneRM: number,
  history: LoggedWorkout[],
  workoutId: string,
): boolean {
  const series = liftSeriesFromHistory(exerciseName, history);
  const sessionIndex = series.findIndex((point) => point.workoutId === workoutId);

  if (sessionIndex <= 0 || sessionIndex !== series.length - 1) {
    return false;
  }

  const priorMax = Math.max(...series.slice(0, sessionIndex).map((point) => point.oneRM));
  return sessionOneRM > priorMax;
}
