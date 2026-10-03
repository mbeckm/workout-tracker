/**
 * Home's model (PLAN Phase 3, W1): the day rows, the selected day, the week lamps and the
 * engraved `WEEK n` label, from the active plan, the history and the clock. Pure TS, no
 * `react-native`, so `scripts/check-device-logic.ts` can assert it with `tsx`.
 *
 * The definitions are PLAN Phase 3's, exactly:
 * - Rows are the plan's trainable days (`trainableDays`).
 * - A row is stamped iff a `LoggedWorkout` with that `dayId` has `completedAt >= startOfLocalWeek(now)`.
 * - Lamps are one per trainable day, filled from `weekSlots(history, weekStart, goal)` in the
 *   order trained, so a repeated day lights a lamp too.
 * - The week is done when `weekSlots` is full.
 * - The selected day is `planLoopProgress(...).nextDayIndex`; if that day is stamped this
 *   week, the first unstamped trainable day.
 */
import { formatEstimateMinutes, estimateDayMinutes } from '@/domain/day-facts';
import { durationIsMinutes, setCount, usesDuration, usesReps } from '@/domain/helpers';
import { weekSlots } from '@/domain/home-numbers';
import { dayIdForPlanWorkout, planLoopProgress, startOfLocalWeek, trainableDays } from '@/domain/plan-loop';
import { workoutPersonalBests } from '@/domain/set-lines';
import type { ExercisePrescription, LoggedWorkout, WorkoutDay, WorkoutPlan } from '@/domain/types';
import { STREAK_MIN, weekStreak } from '@/domain/weeks';

/** The expanded row lists at most this many lines; past it the last line is `+N MORE`. */
export const HOME_LIFT_LINES = 4;

/** Same names as the device `LampState`, without importing the part (it pulls in react-native). */
export type HomeLamp = 'off' | 'on' | 'done';

export type HomeRowDone = {
  workoutId: string;
  /** `MON` */
  weekday: string;
  /** `Monday`, for VoiceOver. */
  weekdaySpoken: string;
  minutes: number;
  sets: number;
};

export type HomeRowStamp = {
  /** `SQUAT PR`, or `2 PRS`. */
  text: string;
  /** `squat record`, `2 records`. */
  spoken: string;
};

export type HomeLiftLine =
  | { kind: 'lift'; name: string; prescription: string }
  | { kind: 'more'; count: number };

export type HomeRow = {
  dayId: string;
  /** Index in `plan.days`. */
  dayIndex: number;
  /** As the user wrote it (`Push 1`); the display uppercases it. */
  title: string;
  liftCount: number;
  /** `~45 MIN`, or null for a day with no lifts. */
  estimate: string | null;
  estimateMinutes: number | null;
  /** This week's latest workout of the day, or null. */
  done: HomeRowDone | null;
  stamp: HomeRowStamp | null;
  selected: boolean;
  /** The expanded row's lines (up to 4; the 4th is `+N MORE` past 4 lifts). */
  lines: HomeLiftLine[];
  accessibilityLabel: string;
};

export type HomeWeek = {
  lamps: HomeLamp[];
  /** Filled slots, capped at the goal. */
  filled: number;
  goal: number;
  done: boolean;
  /** Weeks since the plan's `createdAt`, from 1 (D20's DEFAULT). */
  number: number;
  /** `WEEK 3` */
  label: string;
  /** `  ▲3` when the streak counts (D20), else null. */
  streak: string | null;
  streakCount: number;
  /** The lamp that flickers green for a day just finished, or null. */
  litIndex: number | null;
  accessibilityLabel: string;
};

export type HomeModel =
  | { kind: 'empty' }
  | {
      kind: 'plan';
      planId: string;
      rows: HomeRow[];
      /** Index into `rows`, or -1 when there are none. */
      selectedIndex: number;
      week: HomeWeek;
    };

export type HomeModelInput = {
  plans: readonly WorkoutPlan[];
  plan: WorkoutPlan | null;
  /** Newest first, as the store keeps it. */
  history: readonly LoggedWorkout[];
  now: Date;
  /** The store's plan-loop fallback (`nextDayIndex`), used before the plan has history. */
  fallbackNextDayIndex?: number;
  /** A row the user tapped; wins while it's still a row. */
  pickedDayId?: string | null;
  /** A day whose workout just finished (its lamp flickers). */
  justFinishedDayId?: string | null;
};

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
const WEEKDAYS_SPOKEN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

export function homeModel(input: HomeModelInput): HomeModel {
  const { plan, plans, now } = input;
  // D18: INSERT PLAN only when there are no plans at all.
  if (plans.length === 0 || !plan) {
    return { kind: 'empty' };
  }
  const history = input.history as LoggedWorkout[];
  const weekStart = startOfLocalWeek(now);
  const weekStartMs = weekStart.getTime();

  const trainable = trainableDays(plan);
  // A plan with no lifts anywhere (Build my own, D12) still shows its days, as 0 LIFTS rows,
  // so Start can send the user to the editor.
  const days = trainable.length > 0 ? trainable : plan.days;

  const thisWeek = history.filter((workout) => new Date(workout.completedAt).getTime() >= weekStartMs);
  const latestByDay = new Map<string, LoggedWorkout>();
  for (const workout of thisWeek) {
    const dayId = dayIdForPlanWorkout(workout, plan);
    if (dayId && !latestByDay.has(dayId)) {
      latestByDay.set(dayId, workout);
    }
  }

  const loop = planLoopProgress(plan, history, input.fallbackNextDayIndex ?? 0);
  const loopDayId = plan.days[loop.nextDayIndex]?.id;
  const selectedDayId = pickSelected(days, latestByDay, loopDayId, input.pickedDayId ?? null);

  const rows = days.map((day) => {
    const dayIndex = plan.days.indexOf(day);
    const workout = latestByDay.get(day.id) ?? null;
    const estimateMinutes = estimateDayMinutes(plan, day, history);
    const row: HomeRow = {
      dayId: day.id,
      dayIndex,
      title: day.title,
      liftCount: day.exercises.length,
      estimateMinutes,
      estimate: estimateMinutes == null ? null : formatEstimateMinutes(estimateMinutes).toUpperCase(),
      done: workout ? doneMeta(workout) : null,
      stamp: workout ? prStamp(workout, history) : null,
      selected: day.id === selectedDayId,
      lines: liftLines(day),
      accessibilityLabel: '',
    };
    row.accessibilityLabel = rowLabel(row);
    return row;
  });

  return {
    kind: 'plan',
    planId: plan.id,
    rows,
    selectedIndex: rows.findIndex((row) => row.selected),
    week: weekOf(plan, history, now, weekStart, trainable.length, input.justFinishedDayId ?? null),
  };
}

function pickSelected(
  days: readonly WorkoutDay[],
  latestByDay: ReadonlyMap<string, LoggedWorkout>,
  loopDayId: string | undefined,
  pickedDayId: string | null,
): string | null {
  if (days.length === 0) {
    return null;
  }
  if (pickedDayId && days.some((day) => day.id === pickedDayId)) {
    return pickedDayId;
  }
  const loopDay = days.find((day) => day.id === loopDayId) ?? days[0];
  if (!latestByDay.has(loopDay.id)) {
    return loopDay.id;
  }
  // The loop's day is stamped this week: the first unstamped day; with none left (week
  // complete), the loop's day stays selected and Start repeats it.
  return days.find((day) => !latestByDay.has(day.id))?.id ?? loopDay.id;
}

function doneMeta(workout: LoggedWorkout): HomeRowDone {
  const day = new Date(workout.completedAt).getDay();
  return {
    workoutId: workout.id,
    weekday: WEEKDAYS[day],
    weekdaySpoken: WEEKDAYS_SPOKEN[day],
    minutes: Math.max(1, Math.round(workout.durationMinutes || 0)),
    sets: workout.setCount,
  };
}

/** Leading words that say how, not what (`Flat Barbell Bench Press` stamps `BENCH PR`). */
const QUALIFIERS = new Set([
  'flat',
  'incline',
  'decline',
  'barbell',
  'dumbbell',
  'dumbbells',
  'kettlebell',
  'smith',
  'machine',
  'cable',
  'seated',
  'standing',
  'lying',
  'kneeling',
  'single-arm',
  'one-arm',
  'single-leg',
  'close-grip',
  'wide-grip',
  'neutral-grip',
  'chest-supported',
  'low-to-high',
  'high-to-low',
  'assisted',
  'weighted',
  'ez-bar',
  'trap',
  'back',
  'front',
  'romanian',
  'sumo',
  'leg',
  'lat',
  'calf',
  'hip',
]);

/**
 * The word a PR stamp uses for a lift (`SQUAT PR`, PLAN Phase 3): the name's first word,
 * skipping words that say how or where (`Flat Barbell Bench Press` → `BENCH`).
 */
export function stampName(name: string): string {
  const clean = name.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  const words = clean.split(' ');
  const word = words.find((item, index) => index === words.length - 1 || !QUALIFIERS.has(item.toLowerCase()));
  return (word ?? words[0]).toUpperCase();
}

/** `SQUAT PR` for one lift with a record, `2 PRS` for several (PLAN Phase 3). */
function prStamp(workout: LoggedWorkout, history: readonly LoggedWorkout[]): HomeRowStamp | null {
  const { exerciseIds } = workoutPersonalBests(workout, history as LoggedWorkout[]);
  if (exerciseIds.size === 0) {
    return null;
  }
  if (exerciseIds.size > 1) {
    return { text: `${exerciseIds.size} PRS`, spoken: `${exerciseIds.size} records` };
  }
  const exercise = workout.exercises.find((item) => exerciseIds.has(item.id));
  if (!exercise) {
    return null;
  }
  return { text: `${stampName(exercise.exerciseName)} PR`, spoken: `${exercise.exerciseName.toLowerCase()} record` };
}

/** `0:45` */
function clock(seconds: number): string {
  const value = Math.max(0, Math.round(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

/** The prescription the display prints: `3×8`, holds `3×0:45`, minute cardio `20 MIN`. */
export function displayPrescription(exercise: ExercisePrescription): string {
  if (durationIsMinutes(exercise)) {
    const minutes = Math.max(1, Math.round((exercise.durationSeconds ?? 0) / 60) || 20);
    return `${minutes} MIN`;
  }
  if (usesDuration(exercise.trackingMode) && !usesReps(exercise.trackingMode)) {
    return `${setCount(exercise)}×${clock(exercise.durationSeconds ?? 30)}`;
  }
  return `${setCount(exercise)}×${exercise.reps || 8}`;
}

function liftLines(day: WorkoutDay): HomeLiftLine[] {
  const lifts = day.exercises;
  const overflow = lifts.length > HOME_LIFT_LINES;
  const shown = overflow ? lifts.slice(0, HOME_LIFT_LINES - 1) : lifts;
  const lines: HomeLiftLine[] = shown.map((exercise) => ({
    kind: 'lift',
    name: exercise.name.toUpperCase(),
    prescription: displayPrescription(exercise),
  }));
  if (overflow) {
    lines.push({ kind: 'more', count: lifts.length - shown.length });
  }
  return lines;
}

/** The expanded row's height: 70 + 27 per line, at most 4 (SPEC §5). */
export function expandedRowHeight(liftCount: number, base: number, line: number): number {
  return base + line * Math.min(HOME_LIFT_LINES, liftCount);
}

function spokenMinutes(minutes: number): string {
  return minutes === 1 ? 'about 1 minute' : `about ${minutes} minutes`;
}

function rowLabel(row: HomeRow): string {
  const parts = [row.title];
  if (row.selected) {
    parts.push(row.done ? 'selected' : 'next');
  }
  if (row.done) {
    parts.push(`done ${row.done.weekdaySpoken}`, row.done.sets === 1 ? '1 set' : `${row.done.sets} sets`);
    if (row.stamp) {
      parts.push(row.stamp.spoken);
    }
    return parts.join(', ');
  }
  parts.push(row.liftCount === 1 ? '1 lift' : `${row.liftCount} lifts`);
  if (row.estimateMinutes != null) {
    parts.push(spokenMinutes(row.estimateMinutes));
  }
  return parts.join(', ');
}

/** Weeks since the plan was made, from 1, counting Monday-to-Monday (D20's DEFAULT). */
export function planWeekNumber(createdAt: string, now: Date): number {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) {
    return 1;
  }
  // Round: a DST change makes one week 167 or 169 hours long.
  const days = Math.round((startOfLocalWeek(now).getTime() - startOfLocalWeek(created).getTime()) / DAY_MS);
  return Math.max(1, Math.floor(days / 7) + 1);
}

function weekOf(
  plan: WorkoutPlan,
  history: LoggedWorkout[],
  now: Date,
  weekStart: Date,
  goal: number,
  justFinishedDayId: string | null,
): HomeWeek {
  const slots = weekSlots(history, weekStart, goal);
  const filled = slots.filter((slot) => slot != null).length;
  const full = goal > 0 && filled === goal;
  // The next workout fills the first open slot: that lamp is orange.
  const lamps: HomeLamp[] = slots.map((slot, index) => (slot ? 'done' : index === filled ? 'on' : 'off'));

  let litIndex: number | null = null;
  if (justFinishedDayId) {
    const byId = new Map(history.map((workout) => [workout.id, workout]));
    for (let index = slots.length - 1; index >= 0; index -= 1) {
      const slot = slots[index];
      const workout = slot ? byId.get(slot.id) : undefined;
      if (workout && dayIdForPlanWorkout(workout, plan) === justFinishedDayId) {
        litIndex = index;
        break;
      }
    }
  }

  const number = planWeekNumber(plan.createdAt, now);
  const streakCount = weekStreak(plan, history, now);
  const streak = streakCount >= STREAK_MIN ? `  ▲${streakCount}` : null;
  const spoken = [`Week ${number}`];
  if (goal > 0) {
    spoken.push(`${filled} of ${goal} ${goal === 1 ? 'day' : 'days'} done`);
  }
  if (streak) {
    spoken.push(`${streakCount} weeks in a row`);
  }
  return {
    lamps,
    filled,
    goal,
    done: full,
    number,
    label: `WEEK ${number}`,
    streak,
    streakCount,
    litIndex,
    accessibilityLabel: spoken.join(', '),
  };
}
