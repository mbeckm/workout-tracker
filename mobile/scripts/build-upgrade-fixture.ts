/**
 * Throwaway (not committed): builds a realistic pre-gadget persisted snapshot with the OLD
 * code's own types and helpers, exactly as `saveSnapshot` writes it (JSON under
 * `scratchWorkout.appState.v1`). Usage: tsx scripts/build-upgrade-fixture.ts <out.json>
 */
import { writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

import { bundledExerciseById } from '@/catalog/bundled';
import { withBodyGoal, withReachedBodyGoals } from '@/domain/body-goals';
import { newCheckIn } from '@/domain/check-in';
import { withGoal } from '@/domain/goals';
import { clonePrescription, emptyDay, emptyPlan } from '@/domain/helpers';
import { buildDrafts, type LogSession } from '@/domain/log-session';
import { newId, type LoggedWorkout } from '@/domain/types';
import { homeDemoSnapshot } from '@/store/home-demo';
import { progressDemoSnapshot } from '@/store/progress-demo';
import { defaultSnapshot, normalizeSnapshot, type WorkoutSnapshot } from '@/store/snapshot';

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const out = process.argv[2];
if (!out) {
  throw new Error('usage: build-upgrade-fixture.ts <out.json>');
}

// Plan A (active): Upper Lower, 4 days, ~3 weeks of history, goals (pinned + reached).
const home = homeDemoSnapshot(defaultSnapshot, 'pro-trained');
// Plan B: Push / Pull / Legs, 5 sessions, 3 body check-ins.
const progress = progressDemoSnapshot(defaultSnapshot);
const planA = home.plans[0];
const planB = progress.plans[0];
planB.daysPerWeek = 3;

// An archived plan, with its own finished workout.
const archived = emptyPlan('Old Full Body');
const fullBody = emptyDay('Full body');
fullBody.exercises = ['bundled-barbell-back-squat', 'bundled-flat-barbell-bench-press'].flatMap((id) => {
  const row = bundledExerciseById(id);
  return row ? [{ ...clonePrescription(row), sets: 3, reps: 8, repScheme: null }] : [];
});
archived.days = [fullBody];

// A custom exercise, used on plan B's Push day.
const customExercise = {
  id: newId(),
  name: 'Landmine press',
  equipment: 'barbell',
  muscle: 'shoulders',
  exerciseType: 'strength' as const,
  trackingMode: 'weightAndReps' as const,
  createdAt: '2026-06-01T10:00:00.000Z',
  updatedAt: null,
  isArchived: false,
  notes: 'Half-kneeling',
};
planB.days[0].exercises.push(
  clonePrescription({
    id: customExercise.id,
    name: customExercise.name,
    sets: 3,
    reps: 10,
    bodyParts: ['shoulders'],
    targetMuscles: [],
    secondaryMuscles: [],
    equipments: ['barbell'],
    imageURLs: {},
    itemType: 'strength',
    trackingMode: 'weightAndReps',
  }),
);

function workout(
  title: string,
  completedAt: string,
  planId: string | undefined,
  dayId: string | undefined,
  lifts: [string, [number, number][]][],
): LoggedWorkout {
  const exercises = lifts.map(([name, sets]) => ({
    id: newId(),
    exerciseName: name,
    sets: sets.map(([weight, reps], index) => ({
      id: newId(),
      index,
      weight,
      reps,
      counterweight: null,
      durationSeconds: null,
      distanceMeters: null,
    })),
  }));
  return {
    id: newId(),
    title,
    completedAt,
    durationMinutes: 48,
    exerciseCount: exercises.length,
    setCount: exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0),
    exercises,
    planId,
    dayId,
  };
}

const extraHistory: LoggedWorkout[] = [
  workout('Full body', '2026-02-10T18:00:00.000Z', archived.id, fullBody.id, [
    ['Barbell Back Squat', [[100, 8], [100, 8], [100, 7]]],
    ['Flat Barbell Bench Press', [[70, 8], [70, 8], [67.5, 8]]],
  ]),
  workout('Full body', '2026-02-14T18:00:00.000Z', archived.id, fullBody.id, [
    ['Barbell Back Squat', [[102.5, 8], [102.5, 8], [102.5, 6]]],
    ['Flat Barbell Bench Press', [[70, 8], [70, 8], [70, 7]]],
  ]),
  workout('Push', '2026-08-26T18:00:00.000Z', planB.id, planB.days[0].id, [
    ['Bench press', [[85, 5], [85, 5], [82.5, 5]]],
    ['Landmine press', [[30, 10], [30, 10], [30, 9]]],
  ]),
];

const workoutHistory = [...home.workoutHistory, ...progress.workoutHistory, ...extraHistory].sort(
  (a, b) => b.completedAt.localeCompare(a.completedAt),
);

// Body goals: bodyweight down (open), waist down (reached by a check-in).
let bodyGoals = withBodyGoal([], { metric: 'bodyweightKg', target: 80, start: 83 }, new Date('2026-07-01T19:00:00.000Z'));
bodyGoals = withBodyGoal(bodyGoals, { metric: 'waistCm', target: 82, start: 83 }, new Date('2026-07-01T19:00:00.000Z'));
for (const checkIn of progress.bodyCheckIns) {
  bodyGoals = withReachedBodyGoals(bodyGoals, checkIn);
}
const bodyCheckIns = [
  ...progress.bodyCheckIns,
  newCheckIn({ recordedAt: '2026-09-20T07:30:00.000Z', bodyweightKg: 81.6, waistCm: 80.5 }),
];

// One more lift goal, unpinned (Progress already has three pinned).
const goals = withGoal(home.goals, { exerciseName: 'Barbell row', target: 80, pinned: true }, new Date('2026-08-01T10:00:00.000Z'));

// The open session: plan A's Lower day, first set logged, rest running.
const lower = planA.days.find((day) => day.title === 'Lower') ?? planA.days[1];
const previousSets = (name: string) =>
  workoutHistory.find((item) => item.exercises.some((exercise) => exercise.exerciseName === name))
    ?.exercises.find((exercise) => exercise.exerciseName === name)?.sets ?? [];
const drafts = buildDrafts(lower.exercises, previousSets);
drafts[0].sets[0] = { ...drafts[0].sets[0], weight: 120, reps: 5, done: true };
const nowMs = Date.parse('2026-10-03T17:40:00.000Z');
const activeSession: LogSession = {
  planId: planA.id,
  dayId: lower.id,
  startedAt: new Date(nowMs - 6 * 60_000).toISOString(),
  updatedAt: new Date(nowMs).toISOString(),
  exerciseIndex: 0,
  drafts,
  rest: { startedAtMs: nowMs, endsAtMs: nowMs + 150_000 },
};

const milestoneOwner = [...workoutHistory].reverse();
const snapshot: WorkoutSnapshot = {
  ...defaultSnapshot,
  plans: [planA, planB],
  archivedPlans: [archived],
  activePlanId: planA.id,
  customExercises: [customExercise],
  workoutHistory,
  bodyCheckIns,
  nextDayIndex: 1,
  units: 'lbs',
  appearance: 'dark',
  systemScheme: 'light',
  hasCompletedOnboarding: true,
  userName: 'Marvin',
  postWorkoutPaywallShownAt: '2026-02-10T18:05:00.000Z',
  isPro: true,
  activeSession,
  milestonesShown: {
    'First workout': milestoneOwner[0].id,
    '10th workout': milestoneOwner[9].id,
  },
  goals,
  bodyGoals,
};

// What the old store writes is what it holds; prove the old loader takes it back unchanged.
const persisted = JSON.parse(JSON.stringify(snapshot));
const reloaded = normalizeSnapshot(persisted, new Date(nowMs));
const reloadedJson = JSON.parse(JSON.stringify(reloaded));
for (const key of Object.keys(persisted)) {
  if (!isDeepStrictEqual(reloadedJson[key], persisted[key])) {
    console.log(`old loader changes ${key}`);
    if (process.env.SHOW) console.log(JSON.stringify(persisted[key]).slice(0, 600), '\n=>', JSON.stringify(reloadedJson[key]).slice(0, 600));
  }
}

writeFileSync(out, `${JSON.stringify(persisted, null, 2)}\n`);
console.log(
  `wrote ${out}: ${snapshot.plans.length} plans + ${snapshot.archivedPlans.length} archived, ` +
    `${workoutHistory.length} workouts, ${goals.length} goals (${goals.filter((g) => g.reachedAt).length} reached), ` +
    `${bodyGoals.length} body goals, ${bodyCheckIns.length} check-ins, session ${lower.title}`,
);
