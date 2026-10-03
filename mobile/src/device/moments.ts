/**
 * What plays after a fresh receipt's Done (PLAN Phase 5, D7, D15; trim-ui §12 Moments), and the
 * finished week's report. Pure TS, no `react-native`, so `scripts/check-receipt-logic.ts` can
 * assert it with `tsx`. `moment-host.tsx` runs the steps one at a time.
 *
 * Order, never two modal moments at once:
 * 1. the Home stamp (`justFinished`): the day stamps in and its lamp flickers;
 * 2. the week moment (D15), when this workout just filled the week's slots and the week's ISO key
 *    isn't in `weekMomentsShown`;
 * 3. the post-workout paywall (D7), when `shouldOfferPostWorkoutPaywall`.
 */
import { stampName } from '@/device/home-model';
import { exerciseOneRM, groupThousands, planWeekIndex, receiptDayMonth, receiptLoad, unitLabel, type WeightUnits } from '@/device/receipt-model';
import { workoutVolume } from '@/domain/helpers';
import { weekLiftSummary } from '@/domain/home-numbers';
import { startOfLocalWeek, trainableDays } from '@/domain/plan-loop';
import type { LoggedWorkout, WorkoutPlan } from '@/domain/types';
import { STREAK_MIN, weekStreak } from '@/domain/weeks';

const DAY_MS = 24 * 60 * 60 * 1000;

/** `2026-W40`: the ISO 8601 week of a local date (weeks start on Monday, as Trim's do). */
export function isoWeekKey(date: Date): string {
  const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Thursday of this week decides the ISO year.
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const yearStart = Date.UTC(day.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((day.getTime() - yearStart) / DAY_MS + 1) / 7);
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** The workouts that count toward a week: finished in [weekStart, +7 days) with a set logged. */
export function workoutsInWeek(history: readonly LoggedWorkout[], weekStart: Date): LoggedWorkout[] {
  const start = weekStart.getTime();
  const end = start + 7 * DAY_MS;
  return history.filter((workout) => {
    const at = new Date(workout.completedAt).getTime();
    return workout.setCount > 0 && at >= start && at < end;
  });
}

export type AfterDoneStep =
  | { kind: 'stamp'; dayId: string }
  | { kind: 'week'; weekKey: string; weekStart: string; workoutId: string }
  | { kind: 'paywall' };

export type AfterDoneInput = {
  workout: LoggedWorkout;
  /** Newest first; may or may not hold the workout yet. */
  history: readonly LoggedWorkout[];
  plan: WorkoutPlan | null;
  weekMomentsShown: readonly string[];
  /** `shouldOfferPostWorkoutPaywall` */
  offerPaywall: boolean;
};

/** True when `workout` is the one that filled its week's slots (it wasn't full without it). */
export function workoutFilledWeek(
  workout: LoggedWorkout,
  history: readonly LoggedWorkout[],
  plan: WorkoutPlan | null,
): boolean {
  const goal = plan ? trainableDays(plan).length : 0;
  if (goal === 0 || workout.setCount <= 0) return false;
  const weekStart = startOfLocalWeek(new Date(workout.completedAt));
  const others = workoutsInWeek(history, weekStart).filter((item) => item.id !== workout.id);
  return others.length < goal && others.length + 1 >= goal;
}

/** The moments to play after the fresh receipt closes, in order. */
export function afterDoneSteps(input: AfterDoneInput): AfterDoneStep[] {
  const { workout, history, plan } = input;
  const steps: AfterDoneStep[] = [];
  if (workout.dayId) {
    steps.push({ kind: 'stamp', dayId: workout.dayId });
  }
  const weekStart = startOfLocalWeek(new Date(workout.completedAt));
  const weekKey = isoWeekKey(weekStart);
  if (workoutFilledWeek(workout, history, plan) && !input.weekMomentsShown.includes(weekKey)) {
    steps.push({ kind: 'week', weekKey, weekStart: weekStart.toISOString(), workoutId: workout.id });
  }
  if (input.offerPaywall) {
    steps.push({ kind: 'paywall' });
  }
  return steps;
}

// ---------------------------------------------------------------------------------------------
// The week report (QC2): lifts up, records, volume, best

export type WeekReport = {
  weekKey: string;
  /** `Week 12 done` */
  headline: string;
  /** `8 weeks in a row` once the streak counts, else null. */
  streak: string | null;
  /** `WEEK 12` */
  label: string;
  /** `29 SEP TO 5 OCT` */
  range: string;
  /** One green lamp per planned day. */
  lamps: number;
  liftsUp: number;
  records: number;
  /** `38.9 T`, `9,108 KG`, `20,080 LBS` */
  volume: string;
  /** `SQUAT 127.5`: the week's best estimated max, or null with no weighted sets. */
  best: string | null;
  text: string;
  accessibilityLabel: string;
};

/** Metric volume from 10 t up reads in tonnes (QC2 `38.9 T`); smaller, and pounds, in full. */
export function weekVolume(volume: number, units: WeightUnits): string {
  if (units === 'kg' && volume >= 10000) {
    return `${(Math.round(volume / 100) / 10).toFixed(1)} T`;
  }
  return `${groupThousands(volume)} ${unitLabel(units)}`;
}

export function weekReport(input: {
  history: readonly LoggedWorkout[];
  plan: WorkoutPlan | null;
  units: WeightUnits;
  /** Any date in the week. */
  weekOf: Date;
}): WeekReport {
  const { plan, units } = input;
  const weekStart = startOfLocalWeek(input.weekOf);
  const end = new Date(weekStart.getTime() + 6 * DAY_MS);
  // Everything up to the week's end, so later weeks don't leak into "this week".
  const upTo = input.history.filter((workout) => new Date(workout.completedAt).getTime() < weekStart.getTime() + 7 * DAY_MS);
  const week = workoutsInWeek(upTo, weekStart);
  const { liftsUp, records } = weekLiftSummary(upTo, weekStart);
  const volume = week.reduce((sum, workout) => sum + workoutVolume(workout), 0);

  let best: { name: string; value: number } | null = null;
  for (const workout of week) {
    for (const exercise of workout.exercises) {
      const value = exerciseOneRM(exercise);
      if (value != null && (best == null || value > best.value)) {
        best = { name: exercise.exerciseName, value };
      }
    }
  }

  const number = planWeekIndex(plan, weekStart);
  const goal = plan ? trainableDays(plan).length : week.length;
  const streakCount = plan ? weekStreak(plan, [...upTo], new Date(weekStart.getTime() + 6 * DAY_MS)) : 0;
  const label = number != null ? `WEEK ${number}` : `WEEK OF ${receiptDayMonth(weekStart)}`;
  const range = `${receiptDayMonth(weekStart)} TO ${receiptDayMonth(end)}`;
  const bestText = best ? `${stampName(best.name)} ${receiptLoad(best.value)}` : null;
  const volumeText = weekVolume(volume, units);

  const pair = (left: string, right: string) => `${left}${' '.repeat(Math.max(1, 26 - left.length - right.length))}${right}`;
  const rule = '-'.repeat(26);
  const text = [
    label,
    range,
    rule,
    pair('LIFTS UP', String(liftsUp)),
    pair('RECORDS', `★ ${records}`),
    pair('VOLUME', volumeText),
    ...(bestText ? [rule, pair('BEST', bestText)] : []),
  ].join('\n');

  const headline = number != null ? `Week ${number} done` : 'Week done';
  const streak = streakCount >= STREAK_MIN ? `${streakCount} weeks in a row` : null;
  return {
    weekKey: isoWeekKey(weekStart),
    headline,
    streak,
    label,
    range,
    lamps: Math.max(1, goal),
    liftsUp,
    records,
    volume: volumeText,
    best: bestText,
    text,
    accessibilityLabel: [
      headline,
      streak,
      `${liftsUp} ${liftsUp === 1 ? 'lift' : 'lifts'} up`,
      `${records} ${records === 1 ? 'record' : 'records'}`,
      `volume ${volumeText.toLowerCase()}`,
      best ? `best ${best.name} ${receiptLoad(best.value)}` : null,
    ]
      .filter(Boolean)
      .join(', '),
  };
}
