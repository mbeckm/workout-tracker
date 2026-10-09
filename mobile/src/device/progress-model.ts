/**
 * Progress on the device (Phase 7; SPEC §6 Progress, Lift detail; PRODUCT-DECISIONS 62, 63, 65):
 * the numbers the progress, lift and body sheets show, from the store's data. Pure TS, no
 * `react-native`, so it can be checked with `tsx` against the old screens' numbers.
 *
 * Rounding: a lift's estimated max is whole (`roundOneRM`, PRODUCT-DECISIONS 93) before anything
 * is drawn or subtracted, so the value, its change, the chart and the goal ring agree; body values
 * one decimal.
 */
import { bodyGoalFor, bodyGoalForDisplay, bodyGoalProgress, bodyGoalRemaining, latestBodyValue, type BodyGoal } from '@/domain/body-goals';
import { BODY_METRICS, PROGRESS_INDEX_BODY_METRICS, type BodyCheckIn, type BodyMetricKey } from '@/domain/check-in';
import { monthShort, weekdayShort } from '@/domain/dates';
import { currentOneRM, goalProgress, pinnedGoals, type Goal } from '@/domain/goals';
import { roundOneRM } from '@/domain/helpers';
import { nextTrainableIndex } from '@/domain/plan-loop';
import {
  bodyMetricSeries,
  collectTrackedLifts,
  filterPointsByWindow,
  isInProgressWindow,
  isSessionPR,
  liftSeriesFromHistory,
  sparklineSince,
  type LiftSessionPoint,
  type ProgressPoint,
  type ProgressWindow,
} from '@/domain/progress';
import { normalizedStatsKey, type LoggedSet, type LoggedWorkout, type WorkoutPlan } from '@/domain/types';

type Units = 'kg' | 'lbs';

/* ----------------------------------------------------------------------------------------- *
 * Formatting
 * ----------------------------------------------------------------------------------------- */

/** `96` (a lift's estimated max, whole like the old app) or `82.1` (body, one decimal). */
export function formatProgressNumber(value: number, decimals: 0 | 1): string {
  if (decimals === 0) {
    return String(Math.round(value));
  }
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** The change rounded the way it's shown: whole for lifts, one decimal for body. */
export function roundedChange(change: number, decimals: 0 | 1): number {
  const factor = decimals === 1 ? 10 : 1;
  return Math.round(change * factor) / factor;
}

/** `↑ 6`, `↓ 0.8`, `±0`; a record reads `★ +6` (prototype `.plift .d`). */
export function formatChange(change: number, decimals: 0 | 1, record = false): string {
  const rounded = roundedChange(change, decimals);
  const text = formatProgressNumber(Math.abs(rounded), decimals);
  if (rounded === 0) {
    return '±0';
  }
  if (record && rounded > 0) {
    return `★ +${text}`;
  }
  return rounded > 0 ? `↑ ${text}` : `↓ ${text}`;
}

/** `Thu 2 Oct`, with the year outside this one (trim-ui §9 Dates). */
export function formatSessionDate(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const label = `${weekdayShort(date)} ${date.getDate()} ${monthShort(date)}`;
  return date.getFullYear() === now.getFullYear() ? label : `${label} ${date.getFullYear()}`;
}

/** `2 Oct` (no weekday), for `since 2 Oct` and `Reached 2 Oct`. */
export function formatShortDay(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const label = `${date.getDate()} ${monthShort(date)}`;
  return date.getFullYear() === now.getFullYear() ? label : `${label} ${date.getFullYear()}`;
}

const WINDOW_PHRASE: Record<Exclude<ProgressWindow, 'All'>, string> = {
  '1M': 'in a month',
  '3M': 'in 3 months',
  '6M': 'in 6 months',
  '1Y': 'in a year',
};

/**
 * The change line under the big number (prototype `.lchg`): `↑ 6 in 3 months`,
 * `No change in a month`; `since 1 Mar` for All and while scrubbing (the window's phrase would
 * be wrong for a point inside it).
 */
export function formatChangeLine(
  change: number,
  decimals: 0 | 1,
  window: ProgressWindow,
  firstDate: string,
  scrubbing = false,
): string {
  const rounded = roundedChange(change, decimals);
  const span = window === 'All' || scrubbing ? `since ${formatShortDay(firstDate)}` : WINDOW_PHRASE[window];
  if (rounded === 0) {
    return `No change ${span}`;
  }
  const arrow = rounded > 0 ? '↑' : '↓';
  return `${arrow} ${formatProgressNumber(Math.abs(rounded), decimals)} ${span}`;
}

/** `87.5 × 8, 8, 7`, or `85×8, 80×6` when the weight changes (SPEC §6 Receipt lines). */
export function formatSessionSets(sets: readonly LoggedSet[]): string {
  const weighted = sets.filter((set) => set.weight != null && set.reps != null);
  if (weighted.length === 0) {
    return '';
  }
  const first = weighted[0].weight;
  if (weighted.every((set) => set.weight === first)) {
    return `${first} × ${weighted.map((set) => set.reps).join(', ')}`;
  }
  return weighted.map((set) => `${set.weight}×${set.reps}`).join(', ');
}

/* ----------------------------------------------------------------------------------------- *
 * Progress (the sheet)
 * ----------------------------------------------------------------------------------------- */

export type SparkTone = 'record' | 'flat' | 'ink';

export type GoalCardModel = {
  goal: Goal;
  /** `Bench press 100`. */
  title: string;
  /** `at 92`, `Reached 2 Oct`, or null before any set. */
  sub: string | null;
  /** 0…1, full when reached. */
  progress: number;
  /** `85%`. */
  percent: string;
  reached: boolean;
  accessibilityLabel: string;
};

export type MetricRowModel = {
  key: string;
  /** A lift's name or a body measurement's label. */
  name: string;
  /** `96`, `+22`, `82.1`. */
  value: string;
  unit: string;
  /** The window's points, oldest first (one point: a dot). */
  spark: number[];
  tone: SparkTone;
  /** `↑ 6`, `★ +6`, `±0`, or null with fewer than two points in the window. */
  change: string | null;
  record: boolean;
  accessibilityLabel: string;
};

export type ProgressModel = {
  goals: GoalCardModel[];
  lifts: MetricRowModel[];
  body: { metric: BodyMetricKey; row: MetricRowModel }[];
  /** No lift has a weighted set yet: the next day's lifts, shown dim. */
  empty: { nextLifts: string[] } | null;
};

export type ProgressInput = {
  history: LoggedWorkout[];
  plan: WorkoutPlan | null;
  /** The store's plan loop (`nextDayIndex`), for the empty state's next day. */
  nextDayIndex: number;
  goals: readonly Goal[];
  bodyCheckIns: BodyCheckIn[];
  units: Units;
  now?: Date;
};

function toneFor(spark: number[], change: number | null, record: boolean, decimals: 0 | 1): SparkTone {
  if (record) {
    return 'record';
  }
  if (spark.length >= 2 && change != null && roundedChange(change, decimals) === 0) {
    return 'flat';
  }
  return 'ink';
}

function spokenChange(change: number | null, decimals: 0 | 1, unit: string): string | null {
  if (change == null) {
    return null;
  }
  const rounded = roundedChange(change, decimals);
  if (rounded === 0) {
    return 'no change in 30 days';
  }
  const amount = `${formatProgressNumber(Math.abs(rounded), decimals)} ${unit}`;
  return `${rounded > 0 ? 'up' : 'down'} ${amount} in 30 days`;
}

/** One lift row: the window is the sparkline's 30 days (`PROGRESS_SPARKLINE_DAYS`). */
function liftRow(
  lift: ReturnType<typeof collectTrackedLifts>[number],
  history: LoggedWorkout[],
  units: Units,
  since: number,
): MetricRowModel {
  const series = liftSeriesFromHistory(lift.name, history);
  const inWindow = series.filter((point) => new Date(point.date).getTime() >= since);
  const latest = series.length > 0 ? series[series.length - 1] : null;

  // Pull-ups and dips read as the added weight (`+22`), as on the old Progress.
  if (lift.latestOneRM == null) {
    const spark = inWindow.map((point) => point.bestSet.weight ?? 0);
    const change = spark.length >= 2 ? spark[spark.length - 1] - spark[0] : null;
    const value = lift.indexValue.split(' ')[0] ?? '—';
    return {
      key: normalizedStatsKey(lift.name),
      name: lift.name,
      value,
      unit: units,
      spark,
      tone: toneFor(spark, change, false, 0),
      change: change != null ? formatChange(change, 0) : null,
      record: false,
      accessibilityLabel: [lift.name, lift.spokenValue, spokenChange(change, 0, units)].filter(Boolean).join(', '),
    };
  }

  const spark = inWindow.map((point) => roundOneRM(point.oneRM));
  const change = spark.length >= 2 ? spark[spark.length - 1] - spark[0] : null;
  // A record: the latest session beat every one before it, and it's on this sparkline.
  const record =
    latest != null &&
    inWindow.length > 0 &&
    inWindow[inWindow.length - 1].workoutId === latest.workoutId &&
    isSessionPR(lift.name, latest.oneRM, history, latest.workoutId);
  const value = String(roundOneRM(lift.latestOneRM));
  return {
    key: normalizedStatsKey(lift.name),
    name: lift.name,
    value,
    unit: units,
    spark,
    tone: toneFor(spark, change, record, 0),
    change: change != null ? formatChange(change, 0, record) : null,
    record,
    accessibilityLabel: [
      lift.name,
      `estimated max ${value} ${units}`,
      record ? 'personal best' : null,
      spokenChange(change, 0, units),
    ]
      .filter(Boolean)
      .join(', '),
  };
}

function bodyUnit(metric: BodyMetricKey, units: Units): string {
  return metric === 'bodyweightKg' ? units : 'cm';
}

export function bodyLabel(metric: BodyMetricKey): string {
  return BODY_METRICS.find((item) => item.key === metric)?.label ?? 'Body';
}

function bodyRow(metric: BodyMetricKey, checkIns: BodyCheckIn[], units: Units, since: number): MetricRowModel | null {
  const series = bodyMetricSeries(checkIns, metric, units);
  if (series.length === 0) {
    return null;
  }
  const label = bodyLabel(metric);
  const unit = bodyUnit(metric, units);
  const spark = series.filter((point) => new Date(point.date).getTime() >= since).map((point) => point.value);
  const change = spark.length >= 2 ? spark[spark.length - 1] - spark[0] : null;
  const value = formatProgressNumber(series[series.length - 1].value, 1);
  return {
    key: metric,
    name: label,
    value,
    unit,
    spark,
    tone: toneFor(spark, change, false, 1),
    change: change != null ? formatChange(change, 1) : null,
    record: false,
    accessibilityLabel: [label, `${value} ${unit}`, spokenChange(change, 1, unit)].filter(Boolean).join(', '),
  };
}

/** `current` is `currentOneRM`, already whole: the ring, `at 96` and the percentage agree. */
function goalCard(goal: Goal, current: number | null, units: Units, now: Date): GoalCardModel {
  const reached = goal.reachedAt != null;
  const progress = goalProgress(goal, current);
  const target = formatProgressNumber(goal.target, 1);
  const sub = reached
    ? `Reached ${formatShortDay(goal.reachedAt as string, now)}`
    : current != null
      ? `at ${formatProgressNumber(current, 0)}`
      : null;
  return {
    goal,
    title: `${goal.exerciseName} ${target}`,
    sub,
    progress,
    percent: `${Math.round(progress * 100)}%`,
    reached,
    accessibilityLabel: reached
      ? `${goal.exerciseName} goal, ${target} ${units}, reached`
      : `${goal.exerciseName} goal, ${current != null ? formatProgressNumber(current, 0) : 'no sets yet'} of ${target} ${units}, ${Math.round(progress * 100)} percent`,
  };
}

export function progressModel(input: ProgressInput): ProgressModel {
  const { history, plan, goals, bodyCheckIns, units } = input;
  const now = input.now ?? new Date();
  const since = sparklineSince(undefined, now);
  const tracked = collectTrackedLifts(history, plan, units, null, since);
  const lifts = tracked.map((lift) => liftRow(lift, history, units, since));

  const goalCards = pinnedGoals(goals).map((goal) =>
    goalCard(goal, currentOneRM(goal.exerciseName, history), units, now),
  );

  const body = PROGRESS_INDEX_BODY_METRICS.flatMap((metric) => {
    const row = bodyRow(metric.key, bodyCheckIns, units, since);
    return row ? [{ metric: metric.key, row }] : [];
  });

  let empty: ProgressModel['empty'] = null;
  if (lifts.length === 0) {
    const day = plan && plan.days.length > 0 ? plan.days[nextTrainableIndex(plan, input.nextDayIndex)] : null;
    empty = { nextLifts: day ? day.exercises.map((exercise) => exercise.name) : [] };
  }

  return { goals: goalCards, lifts, body, empty };
}

/** The menu's Progress row: `3 lifts tracked` (no rank, D4). */
export function trackedLiftCount(history: LoggedWorkout[]): number {
  return collectTrackedLifts(history).length;
}

/* ----------------------------------------------------------------------------------------- *
 * Lift and body detail
 * ----------------------------------------------------------------------------------------- */

export type SessionRowModel = {
  id: string;
  date: string;
  /** `Thu 2 Oct`. */
  title: string;
  /** `87.5 × 8, 8, 7`, or `Morning`-free body rows: null. */
  sub: string | null;
  /** `96`, `82.1`. */
  value: string;
  record: boolean;
  accessibilityLabel: string;
};

export type DetailModel = {
  /** Every point, oldest first. */
  series: ProgressPoint[];
  /** The window's points, oldest first: the chart. */
  points: ProgressPoint[];
  latest: number | null;
  /** The window's sessions or check-ins, newest first, at most 6 (as the old detail). */
  sessions: SessionRowModel[];
  /** A record: the latest point beat every one before it (the last dot is yellow). */
  record: boolean;
  decimals: 0 | 1;
  unit: string;
};

const SESSIONS_SHOWN = 6;

export function liftDetailModel(
  name: string,
  history: LoggedWorkout[],
  window: ProgressWindow,
  units: Units,
  now = new Date(),
): DetailModel {
  const series: LiftSessionPoint[] = liftSeriesFromHistory(name, history);
  const all = series.map((point) => ({ date: point.date, value: roundOneRM(point.oneRM) }));
  const points = filterPointsByWindow(all, window, now);
  const latest = series.length > 0 ? series[series.length - 1] : null;
  const sessions = [...series]
    .reverse()
    .filter((point) => isInProgressWindow(point.date, window, now))
    .slice(0, SESSIONS_SHOWN)
    .map((point) => {
      const record = isSessionPR(name, point.oneRM, history, point.workoutId);
      const title = formatSessionDate(point.date, now);
      const sub = formatSessionSets(point.sets);
      const value = String(roundOneRM(point.oneRM));
      return {
        id: point.workoutId,
        date: point.date,
        title,
        sub,
        value,
        record,
        accessibilityLabel: [title, sub, `estimated max ${value} ${units}`, record ? 'personal best' : null]
          .filter(Boolean)
          .join(', '),
      };
    });
  return {
    series: all,
    points,
    latest: latest ? roundOneRM(latest.oneRM) : null,
    sessions,
    record: latest != null && isSessionPR(name, latest.oneRM, history, latest.workoutId),
    decimals: 0,
    unit: units,
  };
}

export function bodyDetailModel(
  metric: BodyMetricKey,
  checkIns: BodyCheckIn[],
  window: ProgressWindow,
  units: Units,
  now = new Date(),
): DetailModel {
  const series = bodyMetricSeries(checkIns, metric, units);
  const points = filterPointsByWindow(series, window, now);
  const unit = bodyUnit(metric, units);
  const sessions = [...series]
    .reverse()
    .filter((point) => isInProgressWindow(point.date, window, now))
    .slice(0, SESSIONS_SHOWN)
    .map((point) => {
      const title = formatSessionDate(point.date, now);
      const value = formatProgressNumber(point.value, 1);
      return {
        id: point.date,
        date: point.date,
        title,
        sub: null,
        value,
        record: false,
        accessibilityLabel: `${title}, ${value} ${unit}`,
      };
    });
  return {
    series,
    points,
    latest: series.length > 0 ? series[series.length - 1].value : null,
    sessions,
    record: false,
    decimals: 1,
    unit,
  };
}

/** A body goal in the user's unit, for the chart's line and the goal row. */
export type BodyGoalView = {
  goal: BodyGoal;
  /** In the user's unit. */
  target: number;
  /** `78 kg, 3.4 kg to go`, `78 kg, reached 2 Oct`. */
  sub: string;
  progress: number;
};

export function bodyGoalView(
  metric: BodyMetricKey,
  goals: readonly BodyGoal[],
  checkIns: readonly BodyCheckIn[],
  units: Units,
  now = new Date(),
): BodyGoalView | null {
  const goal = bodyGoalFor(goals, metric);
  if (!goal) {
    return null;
  }
  const unit = bodyUnit(metric, units);
  const stored = latestBodyValue(checkIns, metric);
  const target = bodyGoalForDisplay(metric, goal.target, units);
  const targetText = `${formatProgressNumber(target, 1)} ${unit}`;
  const remaining = bodyGoalRemaining(goal, stored);
  const sub = goal.reachedAt
    ? `${targetText}, reached ${formatShortDay(goal.reachedAt, now)}`
    : remaining != null
      ? `${targetText}, ${formatProgressNumber(bodyGoalForDisplay(metric, remaining, units), 1)} ${unit} to go`
      : targetText;
  return { goal, target, sub, progress: bodyGoalProgress(goal, stored) };
}

/* ----------------------------------------------------------------------------------------- *
 * Number fields (check-in, goal target)
 * ----------------------------------------------------------------------------------------- */

/** Longest whole part and decimals a body or goal value takes (`9999.99`). */
export const DECIMAL_INPUT = { wholeDigits: 4, decimals: 2 } as const;

/**
 * What a decimal field keeps of what was typed or pasted: digits and at most one separator,
 * `.` or `,` (a German decimal pad types `,`), kept as typed; at most 4 whole digits and 2
 * decimals. `81.181.1` → `81.18`, `1,5,` → `1,5`, `abc` → ``.
 */
export function sanitizeDecimalInput(text: string): string {
  let whole = '';
  let separator = '';
  let decimals = '';
  for (const char of text) {
    if (char >= '0' && char <= '9') {
      if (separator) {
        if (decimals.length < DECIMAL_INPUT.decimals) decimals += char;
      } else if (whole.length < DECIMAL_INPUT.wholeDigits) {
        whole += char;
      }
    } else if ((char === '.' || char === ',') && !separator) {
      separator = char;
    }
  }
  if (separator && whole === '') {
    whole = '0';
  }
  return `${whole}${separator}${decimals}`;
}

/** A positive number from a decimal field, or null for anything malformed (`81.181.1`, `.`, `0`). */
export function parseDecimalInput(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,4}([.,]\d{0,2})?$/.test(trimmed)) {
    return null;
  }
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}
