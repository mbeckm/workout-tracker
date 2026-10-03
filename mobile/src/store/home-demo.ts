import { bundledExerciseById } from '@/catalog/bundled';
import { withGoal, withReachedGoals, type Goal } from '@/domain/goals';
import { clonePrescription, emptyDay, emptyPlan } from '@/domain/helpers';
import { newId, type LoggedSet, type LoggedWorkout, type WorkoutDay } from '@/domain/types';
import type { WorkoutSnapshot } from '@/store/snapshot';

/**
 * Development only: `EXPO_PUBLIC_HOME_DEMO=free` or `=pro` replaces the user's data with a
 * four-day plan and three full weeks of history, dated relative to today, so Home can be
 * checked with real-looking numbers. Add `-trained` (`=pro-trained`) for Home's Just trained
 * state (Upper finished today), `-complete` for Week complete (every day done this week), or
 * `-almost` for every day but Upper done by yesterday, so finishing Upper plays the full week
 * moment on Home (the circle, every ✓, the flame).
 * The fixture is never saved: the store skips persistence while it's on, so turning the flag
 * off brings the real data back.
 */
export type HomeDemoMode =
  | `${'free' | 'pro'}${'' | '-trained' | '-complete' | '-almost'}`
  | GadgetDemoMode;

/**
 * The gadget's Home targets (design/gadget/screens), pinned to this week whatever the weekday:
 * `gadget` is screen 01 (Pull 1 Monday, Legs 1 Tuesday with a squat PR, Push 1 next),
 * `gadget-stamped` is 14 (Push 1 just finished with a bench PR; the stamp plays), `-complete`
 * every day done with a 2-week streak, `-zero` a plan whose days have no lifts, `-seven` a
 * 7-day plan, `-empty` no plans at all. `-history` is `gadget` plus 28 older weeks (110+ workouts,
 * loads creeping up so records land, a few short weeks, one workout from a deleted plan) for
 * the History wall.
 */
export type GadgetDemoMode = `gadget${'' | '-stamped' | '-complete' | '-zero' | '-seven' | '-empty' | '-history'}`;

const MODES: readonly HomeDemoMode[] = [
  'free',
  'pro',
  'free-trained',
  'pro-trained',
  'free-complete',
  'pro-complete',
  'free-almost',
  'pro-almost',
  'gadget',
  'gadget-stamped',
  'gadget-complete',
  'gadget-zero',
  'gadget-seven',
  'gadget-empty',
  'gadget-history',
];

export function homeDemoMode(): HomeDemoMode | null {
  if (!__DEV__) {
    return null;
  }
  const value = process.env.EXPO_PUBLIC_HOME_DEMO;
  return MODES.find((mode) => mode === value) ?? null;
}

/**
 * 18:00 local, `days` days ago. Today's sessions finished `order` minutes ago instead (never
 * before midnight), so they're in the past and keep their order.
 */
function daysAgo(days: number, order = 0): string {
  const now = new Date();
  if (days === 0) {
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return new Date(Math.max(midnight, now.getTime() - (order + 1) * 60_000)).toISOString();
  }
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, 18).toISOString();
}

type Lift = { id: string; sets: number; reps: number };
/**
 * Per session, oldest first: each set as [weight, reps]. The fourth session is this week's,
 * logged only in the `-trained` and `-complete` modes.
 */
type Sessions = [number, number][][];

const DAYS: { title: string; lifts: Lift[]; sessions: Record<string, Sessions> }[] = [
  {
    title: 'Upper',
    lifts: [
      { id: 'bundled-flat-barbell-bench-press', sets: 4, reps: 6 },
      { id: 'bundled-barbell-row', sets: 4, reps: 8 },
      { id: 'bundled-overhead-press', sets: 3, reps: 8 },
      { id: 'bundled-lat-pulldown', sets: 3, reps: 10 },
      { id: 'bundled-low-to-high-cable-fly', sets: 3, reps: 12 },
      { id: 'bundled-barbell-curl', sets: 3, reps: 12 },
    ],
    sessions: {
      'bundled-flat-barbell-bench-press': [
        Array(4).fill([55, 6]),
        Array(4).fill([57.5, 6]),
        Array(4).fill([60, 6]),
        Array(4).fill([62.5, 6]),
      ],
      // Heavier but fewer reps: up, not a record.
      'bundled-barbell-row': [
        Array(4).fill([65, 8]),
        Array(4).fill([67.5, 8]),
        Array(4).fill([70, 8]),
        Array(4).fill([72.5, 6]),
      ],
      'bundled-overhead-press': [
        Array(3).fill([37.5, 8]),
        Array(3).fill([40, 7]),
        [[40, 8], [40, 8], [40, 7]],
        [[40, 8], [40, 8], [40, 7]],
      ],
      'bundled-lat-pulldown': [
        Array(3).fill([50, 10]),
        Array(3).fill([52.5, 10]),
        Array(3).fill([55, 10]),
        Array(3).fill([57.5, 9]),
      ],
      'bundled-low-to-high-cable-fly': [
        Array(3).fill([13, 12]),
        Array(3).fill([14, 12]),
        Array(3).fill([15, 12]),
        Array(3).fill([15, 12]),
      ],
      'bundled-barbell-curl': [
        Array(3).fill([27.5, 10]),
        Array(3).fill([30, 9]),
        Array(3).fill([30, 10]),
        Array(3).fill([30, 10]),
      ],
    },
  },
  {
    title: 'Lower',
    lifts: [
      { id: 'bundled-barbell-back-squat', sets: 5, reps: 5 },
      { id: 'bundled-romanian-deadlift', sets: 4, reps: 8 },
      { id: 'bundled-leg-curl', sets: 3, reps: 12 },
    ],
    sessions: {
      'bundled-barbell-back-squat': [Array(5).fill([95, 5]), Array(5).fill([97.5, 5]), Array(5).fill([100, 5])],
      'bundled-romanian-deadlift': [Array(4).fill([85, 8]), Array(4).fill([87.5, 8]), Array(4).fill([90, 8])],
      'bundled-leg-curl': [Array(3).fill([40, 12]), Array(3).fill([42, 12]), Array(3).fill([44, 12])],
    },
  },
  {
    title: 'Push',
    lifts: [
      { id: 'bundled-incline-bench-press-barbell', sets: 4, reps: 8 },
      { id: 'bundled-dumbbell-bench-press', sets: 3, reps: 10 },
    ],
    sessions: {
      'bundled-incline-bench-press-barbell': [
        Array(4).fill([47.5, 8]),
        Array(4).fill([50, 8]),
        Array(4).fill([52.5, 8]),
        Array(4).fill([55, 8]),
      ],
      'bundled-dumbbell-bench-press': [
        Array(3).fill([22, 10]),
        Array(3).fill([24, 10]),
        Array(3).fill([24, 10]),
        Array(3).fill([26, 8]),
      ],
    },
  },
  {
    title: 'Pull',
    lifts: [
      { id: 'bundled-barbell-row', sets: 4, reps: 8 },
      { id: 'bundled-close-grip-lat-pulldown', sets: 3, reps: 12 },
    ],
    sessions: {
      'bundled-barbell-row': [
        Array(4).fill([65, 8]),
        Array(4).fill([67.5, 8]),
        Array(4).fill([70, 8]),
        Array(4).fill([72.5, 6]),
      ],
      'bundled-close-grip-lat-pulldown': [
        Array(3).fill([45, 12]),
        Array(3).fill([47.5, 12]),
        Array(3).fill([50, 12]),
        Array(3).fill([50, 12]),
      ],
    },
  },
];

/**
 * Days ago for each day's three sessions, oldest first: three full weeks (Lower, Upper, Push,
 * Pull), then Lower yesterday, so the plan loop lands on Upper and the week reads `1 of 4`
 * with a 3-week streak on a Tuesday.
 */
const WHEN: Record<string, [number, number, number]> = {
  Upper: [19, 12, 5],
  Lower: [14, 7, 1],
  Push: [17, 10, 4],
  Pull: [16, 9, 3],
};
/** The oldest Lower, before the three weeks above. */
const FIRST_LOWER = 21;

/**
 * This week's fourth sessions: which days get one, and when. `-trained` finishes Upper today;
 * `-complete` finishes the rest of the week too (Upper, Push and Pull today, after yesterday's
 * Lower), so the plan's goal is reached. Nothing lands before Monday.
 */
function thisWeekSessions(mode: HomeDemoMode): Record<string, number> {
  if (mode.endsWith('-trained')) {
    return { Upper: 0 };
  }
  if (mode.endsWith('-complete')) {
    return { Upper: 0, Push: 0, Pull: 0 };
  }
  if (mode.endsWith('-almost')) {
    // Yesterday, unless today is Monday (then today, so the week still holds them).
    const sinceMonday = (new Date().getDay() + 6) % 7;
    const ago = Math.min(1, sinceMonday);
    return { Push: ago, Pull: ago };
  }
  return {};
}

/** Lift and target (kg), in pin order: the fourth finds Progress full and lives on its detail. */
const DEMO_GOALS: [string, number][] = [
  ['bundled-flat-barbell-bench-press', 70],
  ['bundled-barbell-back-squat', 125],
  ['bundled-romanian-deadlift', 120],
  ['bundled-overhead-press', 55],
  // Unpinned; finishing Upper at its Pro target (57.5 × 10) reaches it, for Done's goal row.
  ['bundled-lat-pulldown', 75],
];

function loggedSets(sets: [number, number][]): LoggedSet[] {
  return sets.map(([weight, reps], index) => ({
    id: newId(),
    index,
    weight,
    reps,
    counterweight: null,
    durationSeconds: null,
    distanceMeters: null,
  }));
}

export function homeDemoSnapshot(base: WorkoutSnapshot, mode: HomeDemoMode): WorkoutSnapshot {
  if (mode.startsWith('gadget')) {
    return gadgetDemoSnapshot(base, mode as GadgetDemoMode);
  }
  const plan = emptyPlan('Upper Lower');
  const days: WorkoutDay[] = DAYS.map(({ title, lifts }) => {
    const day = emptyDay(title);
    day.exercises = lifts.flatMap(({ id, sets, reps }) => {
      const row = bundledExerciseById(id);
      return row ? [{ ...clonePrescription(row), sets, reps, repScheme: null }] : [];
    });
    return day;
  });
  plan.days = days;

  const workouts: LoggedWorkout[] = [];
  const extra = thisWeekSessions(mode);
  DAYS.forEach(({ title, lifts, sessions }, dayIndex) => {
    const day = days[dayIndex];
    const when = title === 'Lower' ? [FIRST_LOWER, ...WHEN.Lower] : [...WHEN[title]];
    if (extra[title] != null) {
      when.push(extra[title]);
    }
    when.forEach((ago, whenIndex) => {
      // The extra oldest Lower repeats its first session.
      const session = title === 'Lower' ? Math.max(0, whenIndex - 1) : whenIndex;
      const exercises = day.exercises.map((exercise, index) => ({
        id: newId(),
        exerciseName: exercise.name,
        sets: loggedSets(sessions[lifts[index].id][session]),
      }));
      workouts.push({
        id: newId(),
        title,
        completedAt: daysAgo(ago, DAYS.length - dayIndex),
        durationMinutes: 44 + ((dayIndex * 3 + whenIndex * 2) % 9),
        exerciseCount: exercises.length,
        setCount: exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0),
        exercises,
        planId: plan.id,
        dayId: day.id,
      });
    });
  });
  workouts.sort((a, b) => b.completedAt.localeCompare(a.completedAt));

  // Goals for Progress: three pinned (Bench Press already reached), one on its detail only.
  let goals: Goal[] = [];
  const created = new Date(daysAgo(FIRST_LOWER + 1));
  for (const [id, target] of DEMO_GOALS) {
    const row = bundledExerciseById(id);
    if (row) {
      goals = withGoal(goals, { exerciseName: row.name, target, pinned: true }, created);
    }
  }
  for (const workout of [...workouts].reverse()) {
    goals = withReachedGoals(goals, workout);
  }

  return {
    ...base,
    hasCompletedOnboarding: true,
    userName: 'Marvin',
    activePlanId: plan.id,
    plans: [plan],
    units: 'kg',
    // Follows the Simulator's light/dark setting, so both can be checked without the app's own.
    appearance: 'system',
    isPro: mode.startsWith('pro'),
    activeSession: null,
    workoutHistory: workouts,
    goals,
    nextDayIndex: 0,
  };
}

// ---------------------------------------------------------------------------------------------
// Gadget Home targets

/** `name` shows the targets' short names (the fixture is never saved). */
type GadgetLift = { id: string; sets: number; reps: number; name?: string };

const GADGET_DAYS: { title: string; lifts: GadgetLift[]; minutes: number }[] = [
  {
    title: 'Pull 1',
    minutes: 48,
    lifts: [
      { id: 'bundled-barbell-row', sets: 3, reps: 8 },
      { id: 'bundled-lat-pulldown', sets: 3, reps: 10 },
      { id: 'bundled-barbell-curl', sets: 3, reps: 12 },
    ],
  },
  {
    title: 'Legs 1',
    minutes: 55,
    lifts: [
      { id: 'bundled-barbell-back-squat', sets: 3, reps: 6, name: 'Squat' },
      { id: 'bundled-leg-curl', sets: 3, reps: 12 },
      { id: 'bundled-romanian-deadlift', sets: 3, reps: 8 },
    ],
  },
  {
    title: 'Push 1',
    minutes: 45,
    lifts: [
      { id: 'bundled-flat-barbell-bench-press', sets: 3, reps: 8, name: 'Bench Press' },
      { id: 'bundled-cable-chest-fly', sets: 3, reps: 12, name: 'Cable Fly' },
      { id: 'bundled-overhead-press', sets: 3, reps: 8 },
    ],
  },
  {
    title: 'Legs 2',
    minutes: 45,
    lifts: [
      { id: 'bundled-barbell-back-squat', sets: 3, reps: 6, name: 'Squat' },
      { id: 'bundled-romanian-deadlift', sets: 3, reps: 8 },
      { id: 'bundled-leg-curl', sets: 3, reps: 12 },
    ],
  },
];

/** `weekday` days after this week's Monday at 18:00, or a few minutes ago if that's still ahead. */
function thisWeekAt(weekday: number, order = 0): string {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const at = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + weekday, 18);
  const latest = now.getTime() - (order + 1) * 60_000;
  return new Date(Math.min(at.getTime(), latest)).toISOString();
}

function gadgetDemoSnapshot(base: WorkoutSnapshot, mode: GadgetDemoMode): WorkoutSnapshot {
  const now = new Date();
  const weeksAgo = (weeks: number, weekday: number) => {
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) - weeks * 7);
    return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + weekday, 18).toISOString();
  };
  const common = {
    ...base,
    hasCompletedOnboarding: true,
    userName: 'Marvin',
    units: 'kg' as const,
    isPro: true,
    activeSession: null,
    goals: [],
    nextDayIndex: 0,
  };
  if (mode === 'gadget-empty') {
    return { ...common, activePlanId: null, plans: [], workoutHistory: [] };
  }

  const plan = emptyPlan('Push Pull Legs');
  // WEEK 12, as on the targets.
  plan.createdAt = weeksAgo(11, 0);

  if (mode === 'gadget-zero') {
    plan.name = 'My plan';
    plan.days = ['Day 1', 'Day 2', 'Day 3'].map((title) => emptyDay(title));
    return { ...common, activePlanId: plan.id, plans: [plan], workoutHistory: [] };
  }

  const specs =
    mode === 'gadget-seven'
      ? [...GADGET_DAYS, ...GADGET_DAYS.slice(0, 3).map((spec) => ({ ...spec, title: spec.title.replace('1', '2') }))]
      : GADGET_DAYS;
  if (mode === 'gadget-seven') {
    specs[6] = { ...specs[6], title: 'Arms', lifts: [...specs[0].lifts, ...specs[2].lifts] };
  }
  plan.days = specs.map(({ title, lifts }) => {
    const day = emptyDay(title);
    day.exercises = lifts.flatMap(({ id, sets, reps, name }) => {
      const row = bundledExerciseById(id);
      return row ? [{ ...clonePrescription(row), name: name ?? row.name, sets, reps, repScheme: null }] : [];
    });
    return day;
  });

  const workouts: LoggedWorkout[] = [];
  const log = (dayIndex: number, completedAt: string, load: number, onlySets?: number) => {
    const day = plan.days[dayIndex];
    const exercises = day.exercises.map((exercise) => ({
      id: newId(),
      exerciseName: exercise.name,
      sets: loggedSets(Array(exercise.sets).fill([load, exercise.reps])),
    }));
    const kept = onlySets ? exercises.slice(0, 1).map((item) => ({ ...item, sets: item.sets.slice(0, onlySets) })) : exercises;
    workouts.push({
      id: newId(),
      title: day.title,
      completedAt,
      durationMinutes: onlySets ? 1 : specs[dayIndex].minutes,
      exerciseCount: kept.length,
      setCount: kept.reduce((sum, exercise) => sum + exercise.sets.length, 0),
      exercises: kept,
      planId: plan.id,
      dayId: day.id,
    });
  };

  // Last week in full, so records and estimates have something to stand on (and a finished
  // week makes a 2-week streak, shown on the complete week only).
  plan.days.forEach((_, index) => log(index, weeksAgo(1, Math.min(index, 6)), 80));
  // This week: Pull 1 Monday (no record: same load), Legs 1 Tuesday with a squat PR.
  log(0, thisWeekAt(0, 3), 80);
  log(1, thisWeekAt(1, 2), 80);
  const legs = workouts[workouts.length - 1];
  legs.exercises[0].sets.forEach((set) => (set.weight = 85));
  if (mode === 'gadget-stamped') {
    // Push 1 just now: one set, a bench record.
    log(2, thisWeekAt(6, 0), 85, 1);
  }
  if (mode === 'gadget-complete') {
    log(2, thisWeekAt(2, 1), 80);
    log(3, thisWeekAt(3, 0), 80);
  }
  if (mode === 'gadget-history') {
    const weekdays = [0, 1, 3, 5];
    for (let weeks = 29; weeks >= 2; weeks -= 1) {
      const load = 52.5 + 2.5 * Math.floor((29 - weeks) / 3);
      const count = weeks % 7 === 3 ? 2 : weeks % 5 === 1 ? 3 : 4;
      for (let index = 0; index < count; index += 1) {
        log(index, weeksAgo(weeks, weekdays[index]), load);
        workouts[workouts.length - 1].durationMinutes = specs[index].minutes - 6 + ((weeks * 7 + index * 3) % 13);
      }
    }
    // A plan that was deleted since: its workouts keep their own title.
    const bench = plan.days[2].exercises[0];
    workouts.push({
      id: newId(),
      title: 'Full Body',
      completedAt: weeksAgo(5, 6),
      durationMinutes: 62,
      exerciseCount: 1,
      setCount: 3,
      exercises: [{ id: newId(), exerciseName: bench.name, sets: loggedSets([[60, 10], [65, 8], [70, 6]]) }],
      planId: 'deleted-plan',
      dayId: 'deleted-day',
    });
  }
  workouts.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  // The plan loop starts each week where it left off; last week ended on the last day.
  return { ...common, activePlanId: plan.id, plans: [plan], workoutHistory: workouts };
}
