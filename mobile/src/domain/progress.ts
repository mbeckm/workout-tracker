import {
  bodyMetricForDisplay,
  type BodyMetricKey,
  type BodyCheckIn,
  type WeightUnits,
} from '@/domain/check-in';
import { estimatedOneRM, formatLoggedSetLine, roundOneRM } from '@/domain/helpers';
import type { LoggedExercise, LoggedSet, LoggedWorkout, WorkoutPlan } from '@/domain/types';
import { normalizedStatsKey } from '@/domain/types';
import { formatMonthDay } from '@/domain/dates';

export type ProgressWindow = '1M' | '3M' | '6M' | '1Y' | 'All';

export const PROGRESS_WINDOWS: ProgressWindow[] = ['1M', '3M', '6M', '1Y', 'All'];

/**
 * Pro boundary (PRODUCT-DECISIONS 63): free keeps the recent view (`1M`, `3M`); Trim Pro
 * unlocks the long view (`6M`, `1Y`, `All`). `isProgressWindowLocked` feeds
 * `WindowChips.locked` on lift and body detail.
 */
export const FREE_PROGRESS_WINDOWS: readonly ProgressWindow[] = ['1M', '3M'];

export function isProgressWindowLocked(window: ProgressWindow, isPro: boolean): boolean {
  return !isPro && !FREE_PROGRESS_WINDOWS.includes(window);
}

/** Default chip: a month, the window Progress's sparklines show. */
export function defaultProgressWindow(_isPro?: boolean): ProgressWindow {
  return '1M';
}

/**
 * Progress heroes (`StaggerValue`) format with Intl, which follows the device region
 * ("80,5"). The rows under them are plain strings ("80.5 kg"), so heroes pin this locale
 * and turn grouping off to read the same.
 */
export const PROGRESS_HERO_LOCALE = 'en-US';

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
  /** Latest session with a weighted set: the row's `Last Sep 25`, like body rows. */
  latestDate: string | null;
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
  sparklineSinceMs: number | null,
): Omit<TrackedLift, 'name'> {
  const series = liftSeriesFromHistory(name, history);
  const latestDate = series.length > 0 ? series[series.length - 1].date : null;
  // The sparkline never reaches further back than the detail screen can open, and on
  // Progress v3 covers the sparkline window (`PROGRESS_SPARKLINE_DAYS`).
  const sparkSeries = series.filter(
    (point) =>
      (sparklineWindow == null || isInProgressWindow(point.date, sparklineWindow)) &&
      (sparklineSinceMs == null || new Date(point.date).getTime() >= sparklineSinceMs),
  );

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
      latestDate,
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
    latestDate,
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

  const months = window === '1M' ? 1 : window === '3M' ? 3 : window === '6M' ? 6 : 12;
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

/**
 * Progress v3's sparklines cover the last 30 days (PRODUCT-DECISIONS 62), sensible for most
 * lifters; 90 days for advanced lifters is a later setting.
 */
export const PROGRESS_SPARKLINE_DAYS = 30;

/** Start of the sparkline window, `days` before now. */
export function sparklineSince(days = PROGRESS_SPARKLINE_DAYS, now = new Date()): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days).getTime();
}

export function formatProgressWeight(value: number, units: 'kg' | 'lbs'): string {
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(Math.round(rounded)) : rounded.toFixed(1);
  return `${text} ${units}`;
}

/** `94 kg`: an estimated 1RM, whole (`roundOneRM`, PRODUCT-DECISIONS 93). */
export function formatProgressOneRM(value: number, units: 'kg' | 'lbs'): string {
  return `${roundOneRM(value)} ${units}`;
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
  sparklineSinceMs: number | null = null,
): TrackedLift[] {
  const names = exerciseNamesFromHistory(history);
  const planOrder = planExerciseOrder(activePlan);
  const planRank = new Map(planOrder.map((key, index) => [key, index]));

  const lifts = [...names.entries()].map(([key, name]) => {
    const presentation = liftIndexPresentation(name, history, units, sparklineWindow, sparklineSinceMs);

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

  return lifts.map(({ name, latestOneRM, sparkline, indexValue, spokenValue, latestDate }) => ({
    name,
    latestOneRM,
    sparkline,
    indexValue,
    spokenValue,
    latestDate,
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

/**
 * `Sep 25` (`Sep 25, 2025` outside this year), built from parts in the app's English order
 * like Weeks: a locale format would read `25. Sep` on a German-region phone.
 */
export function formatProgressShortDate(iso: string, now: Date = new Date()): string {
  return formatMonthDay(new Date(iso), now);
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

const WINDOW_LABELS: Record<ProgressWindow, string> = {
  '1M': 'Last month',
  '3M': 'Last 3 months',
  '6M': 'Last 6 months',
  '1Y': 'Last year',
  All: 'All time',
};

/** The range under a detail hero (`Last 3 months`); the scrubbed date takes its place. */
export function formatProgressWindow(window: ProgressWindow): string {
  return WINDOW_LABELS[window];
}

/** VoiceOver summary of a chart: `Estimated 1-rep max, 95 kg on Jun 3 to 102 kg on Sep 14`. */
export function formatProgressChartSummary(
  label: string,
  points: ProgressPoint[],
  formatValue: (value: number) => string,
): string | undefined {
  if (points.length === 0) {
    return undefined;
  }
  const first = points[0];
  const last = points[points.length - 1];
  const start = `${formatValue(first.value)} on ${formatProgressShortDate(first.date)}`;
  if (points.length === 1) {
    return `${label}, ${start}`;
  }
  return `${label}, ${start} to ${formatValue(last.value)} on ${formatProgressShortDate(last.date)}`;
}
