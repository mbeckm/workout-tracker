import { monthLong, monthShort } from '@/domain/dates';
import { startOfLocalWeek, trainableDays, workoutsSince } from '@/domain/plan-loop';
import type { LoggedWorkout, WorkoutPlan } from '@/domain/types';

/** One Monday-based week against the plan's goal. */
export type WeekTally = {
  /** Monday 00:00, local time. */
  start: Date;
  /** Workouts that week, capped at the goal. */
  count: number;
  isCurrent: boolean;
};

export type RecentWeeks = {
  /** The active plan's trainable days: the only goal Trim knows (past goals aren't stored). */
  goal: number;
  /** Newest first. This week is always there; past weeks start at the first workout ever. */
  weeks: WeekTally[];
  /** Mean of the finished weeks shown (this week excluded), or null when there are none. */
  average: number | null;
};

export const RECENT_WEEK_COUNT = 8;

function addDays(date: Date, days: number): Date {
  // Calendar arithmetic, so a DST change doesn't shift the week by an hour.
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * The week amount over time (F6). Every week counts finished workouts, a repeated day too
 * (PRODUCT-DECISIONS 51), capped at the current goal; this week is exactly Home's number.
 */
export function recentWeeks(
  plan: WorkoutPlan | null | undefined,
  history: LoggedWorkout[],
  now = new Date(),
  weekCount = RECENT_WEEK_COUNT,
): RecentWeeks {
  const goal = plan ? trainableDays(plan).length : 0;
  const thisWeek = startOfLocalWeek(now);
  const finished = history.filter((workout) => workout.setCount > 0);
  const firstMs = finished.reduce(
    (min, workout) => Math.min(min, new Date(workout.completedAt).getTime()),
    Number.POSITIVE_INFINITY,
  );
  const firstWeekMs = Number.isFinite(firstMs)
    ? startOfLocalWeek(new Date(firstMs)).getTime()
    : thisWeek.getTime();

  const weeks: WeekTally[] = [
    {
      start: thisWeek,
      count: Math.min(workoutsSince(history, thisWeek), goal),
      isCurrent: true,
    },
  ];

  for (let back = 1; back < weekCount; back += 1) {
    const start = addDays(thisWeek, -7 * back);
    if (start.getTime() < firstWeekMs) {
      break;
    }
    const fromMs = start.getTime();
    const toMs = addDays(start, 7).getTime();
    const done = finished.filter((workout) => {
      const at = new Date(workout.completedAt).getTime();
      return at >= fromMs && at < toMs;
    }).length;
    weeks.push({ start, count: Math.min(done, goal), isCurrent: false });
  }

  const past = weeks.filter((week) => !week.isCurrent);
  const average =
    past.length > 0
      ? Math.round((past.reduce((sum, week) => sum + week.count, 0) / past.length) * 10) / 10
      : null;

  return { goal, weeks, average };
}

/** `This week`, `Last week`, then `Sep 8 – 14` (or `Aug 25 – Sep 1` across months). */
export function formatWeekLabel(week: WeekTally, now = new Date()): string {
  if (week.isCurrent) {
    return 'This week';
  }
  const lastWeek = addDays(startOfLocalWeek(now), -7);
  if (week.start.getTime() === lastWeek.getTime()) {
    return 'Last week';
  }
  const end = addDays(week.start, 6);
  // Built from parts in the app's English order (`Sep 7`), like History's `Wed 13`; a
  // locale date format would give `7. Sep – 13` on a German-region phone.
  const startLabel = `${monthShort(week.start)} ${week.start.getDate()}`;
  if (end.getMonth() === week.start.getMonth()) {
    return `${startLabel} – ${end.getDate()}`;
  }
  return `${startLabel} – ${monthShort(end)} ${end.getDate()}`;
}

/** `3.4`, `3`: one decimal at most, with a point like every other number in Trim. */
export function formatWeeklyAverage(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/** VoiceOver: `Week of September 8, 2 of 5`; `This week, 3 of 5, goal met`. */
export function spokenWeek(week: WeekTally, goal: number, now = new Date()): string {
  const label = formatWeekLabel(week, now);
  const when =
    label === 'This week' || label === 'Last week'
      ? label
      : `Week of ${monthLong(week.start)} ${week.start.getDate()}`;
  const met = goal > 0 && week.count >= goal ? ', goal met' : '';
  return `${when}, ${week.count} of ${goal}${met}`;
}

/** A streak is only worth stating from two weeks up: one full week is just the dots. */
export const STREAK_MIN = 2;

/**
 * Full weeks in a row: weeks that met the active plan's goal, counted back from this week if
 * it's already full, else from last week (a week still in progress doesn't break the streak).
 * Weeks count the same way as Home and Weeks' rows (every finished workout, a repeated day
 * too), so a full green row there is a streak week. Zero when the plan has fewer than two
 * trainable days, since Home shows no week for it.
 */
export function weekStreak(
  plan: WorkoutPlan | null | undefined,
  history: LoggedWorkout[],
  now = new Date(),
): number {
  const goal = plan ? trainableDays(plan).length : 0;
  if (goal < 2) {
    return 0;
  }
  const thisWeek = startOfLocalWeek(now);

  // One pass: workouts per past week, keyed by that week's Monday.
  const perWeek = new Map<number, number>();
  let firstWeekMs = thisWeek.getTime();
  for (const workout of history) {
    if (workout.setCount <= 0) {
      continue;
    }
    const weekMs = startOfLocalWeek(new Date(workout.completedAt)).getTime();
    perWeek.set(weekMs, (perWeek.get(weekMs) ?? 0) + 1);
    firstWeekMs = Math.min(firstWeekMs, weekMs);
  }

  const thisWeekFull = workoutsSince(history, thisWeek) >= goal;
  let streak = thisWeekFull ? 1 : 0;
  let start = addDays(thisWeek, -7);
  while (start.getTime() >= firstWeekMs && (perWeek.get(start.getTime()) ?? 0) >= goal) {
    streak += 1;
    start = addDays(start, -7);
  }
  return streak;
}

/** `4 weeks in a row`. */
export function formatWeekStreak(streak: number): string {
  return `${streak} weeks in a row`;
}
