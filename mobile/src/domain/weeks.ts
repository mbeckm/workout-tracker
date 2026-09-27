import { completedPlanDayIdsSince, startOfLocalWeek, trainableDays } from '@/domain/plan-loop';
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
 * The week amount over time (F6). This week is exactly Home's number: distinct days of the
 * active plan done since Monday. Past weeks count every finished workout from any plan, since
 * the plan may have changed; both are capped at the current goal.
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
      count: Math.min(completedPlanDayIdsSince(plan, history, thisWeek).length, goal),
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

/**
 * `Sep`, `Oct`: the month alone in English (the app's copy is English), so callers can put it
 * in the app's order (`Oct 4`) on any region or device language.
 */
export function monthShort(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short' });
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
      : `Week of ${week.start.toLocaleDateString(undefined, { month: 'long' })} ${week.start.getDate()}`;
  const met = goal > 0 && week.count >= goal ? ', goal met' : '';
  return `${when}, ${week.count} of ${goal}${met}`;
}
