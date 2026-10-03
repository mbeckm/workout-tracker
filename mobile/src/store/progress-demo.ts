import { newCheckIn } from '@/domain/check-in';
import { clonePrescription, emptyDay, emptyPlan } from '@/domain/helpers';
import { newId, type LoggedWorkout } from '@/domain/types';
import type { WorkoutSnapshot } from '@/store/snapshot';

/** Fixed calendar dates so demo matches Paper artboards regardless of run day. */
function onDate(isoDate: string): string {
  return `${isoDate}T18:00:00.000Z`;
}

function set(weight: number, reps: number, index = 0) {
  return {
    id: newId(),
    index,
    weight,
    reps,
    counterweight: null,
    durationSeconds: null,
    distanceMeters: null,
  };
}

function benchSession(
  completedAt: string,
  weight: number,
  reps: number,
  extraExercises: { name: string; weight: number; reps: number }[] = [],
): LoggedWorkout {
  const exercises = [
    { name: 'Bench press', weight, reps },
    ...extraExercises,
  ];
  return {
    id: newId(),
    title: 'Push day',
    completedAt,
    durationMinutes: 55,
    exerciseCount: exercises.length,
    setCount: exercises.length,
    exercises: exercises.map((exercise) => ({
      id: newId(),
      exerciseName: exercise.name,
      sets: [set(exercise.weight, exercise.reps)],
    })),
  };
}

/** `daysAgo` days before today at 18:00 local: the gadget fixture moves with the run day. */
function daysAgo(days: number, now = new Date()): string {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, 18).toISOString();
}

type DemoLift = { name: string; title: string; sessions: [days: number, weight: number, reps: number[]][] };

/**
 * The gadget Progress fixture (`EXPO_PUBLIC_PROGRESS_DEMO=gadget`, Phase 7): screen 18's shape
 * relative to today, so the 30-day sparklines have points. Bench press ends on a record, Squat
 * and Deadlift rise below an older best, Overhead press is flat, body weight goes down. Goals:
 * Bench and Squat pinned, Overhead press reached; a body-weight goal.
 */
function progressGadgetSnapshot(base: WorkoutSnapshot): WorkoutSnapshot {
  const lifts: DemoLift[] = [
    {
      name: 'Bench press',
      title: 'Push 1',
      sessions: [
        [84, 72.5, [8, 8, 7]],
        [77, 72.5, [8, 8, 8]],
        [70, 75, [7, 7, 6]],
        [63, 75, [8, 7, 7]],
        [56, 77.5, [7, 7, 6]],
        [49, 77.5, [8, 7, 7]],
        [42, 80, [7, 6, 6]],
        [35, 80, [8, 7, 7]],
        [28, 80, [8, 8, 7]],
        [21, 82.5, [7, 7, 6]],
        [14, 82.5, [8, 7, 7]],
        [7, 85, [7, 6, 6]],
        [1, 87.5, [8, 8, 7]],
      ],
    },
    {
      name: 'Squat',
      title: 'Legs 1',
      sessions: [
        [60, 110, [6, 6, 5]],
        [26, 105, [5, 5, 5]],
        [19, 105, [6, 6, 5]],
        [12, 107.5, [6, 5, 5]],
        [5, 110, [5, 5, 5]],
      ],
    },
    {
      name: 'Deadlift',
      title: 'Pull 1',
      sessions: [
        [45, 150, [5, 5, 4]],
        [27, 140, [5, 5, 5]],
        [20, 140, [5, 5, 4]],
        [13, 142.5, [5, 5, 5]],
        [6, 145, [5, 5, 4]],
      ],
    },
    {
      name: 'Overhead press',
      title: 'Push 1',
      sessions: [
        [40, 52.5, [8, 7, 7]],
        [25, 50, [8, 8, 8]],
        [18, 50, [8, 8, 7]],
        [11, 50, [8, 7, 7]],
        [4, 50, [8, 8, 8]],
      ],
    },
  ];

  const workoutHistory: LoggedWorkout[] = lifts
    .flatMap((lift) =>
      lift.sessions.map(([days, weight, reps]) => ({
        id: newId(),
        title: lift.title,
        completedAt: daysAgo(days),
        durationMinutes: 52,
        exerciseCount: 1,
        setCount: reps.length,
        exercises: [{ id: newId(), exerciseName: lift.name, sets: reps.map((count, index) => set(weight, count, index)) }],
      })),
    )
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt));

  const plan = emptyPlan('Push Pull Legs');
  const day = emptyDay('Push 1');
  day.exercises = lifts.map((lift) =>
    clonePrescription({
      id: newId(),
      name: lift.name,
      sets: 3,
      reps: 8,
      bodyParts: [],
      targetMuscles: [],
      secondaryMuscles: [],
      equipments: [],
      imageURLs: {},
      itemType: 'strength',
      trackingMode: 'weightAndReps',
    }),
  );
  plan.days = [day];

  const created = daysAgo(90);
  return {
    ...base,
    hasCompletedOnboarding: true,
    activePlanId: plan.id,
    plans: [plan],
    units: 'kg',
    workoutHistory,
    goals: [
      { id: newId(), exerciseName: 'Bench press', target: 130, pinned: true, createdAt: created, reachedAt: null },
      { id: newId(), exerciseName: 'Squat', target: 160, pinned: true, createdAt: daysAgo(80), reachedAt: null },
      { id: newId(), exerciseName: 'Overhead press', target: 60, pinned: true, createdAt: daysAgo(70), reachedAt: daysAgo(25) },
    ],
    bodyGoals: [
      { id: newId(), metric: 'bodyweightKg', target: 78, start: 83, createdAt: created, reachedAt: null },
    ],
    bodyCheckIns: [
      newCheckIn({ recordedAt: daysAgo(60), bodyweightKg: 82.6, waistCm: 85 }),
      newCheckIn({ recordedAt: daysAgo(28), bodyweightKg: 82.2, waistCm: 84 }),
      newCheckIn({ recordedAt: daysAgo(21), bodyweightKg: 82 }),
      newCheckIn({ recordedAt: daysAgo(14), bodyweightKg: 81.9 }),
      newCheckIn({ recordedAt: daysAgo(7), bodyweightKg: 81.6 }),
      newCheckIn({ recordedAt: daysAgo(1), bodyweightKg: 81.4, waistCm: 83 }),
    ],
  };
}

/** Paper judgment-journey fixture (Marvin) for Progress visual QA. */
export function progressDemoSnapshot(base: WorkoutSnapshot): WorkoutSnapshot {
  if (progressDemoMode() === 'gadget') {
    return progressGadgetSnapshot(base);
  }
  const plan = emptyPlan('Push / Pull / Legs');
  const pushDay = emptyDay('Push');
  pushDay.exercises = [
    'Bench press',
    'Squat',
    'Deadlift',
    'Overhead press',
    'Barbell row',
    'Pull-up',
  ].map((name) =>
    clonePrescription({
      id: newId(),
      name,
      sets: 3,
      reps: 5,
      bodyParts: [],
      targetMuscles: [],
      secondaryMuscles: [],
      equipments: [],
      imageURLs: {},
      itemType: 'strength',
      trackingMode: 'weightAndReps',
    }),
  );
  plan.days = [pushDay];

  // Index values: Paper A′a uses ~132 / 165 / 58 / 88 / +22 (e1RM ≈ weight×1.167 for ×5).
  const latestExtras = [
    { name: 'Squat', weight: 113, reps: 5 },
    { name: 'Deadlift', weight: 141.5, reps: 5 },
    { name: 'Overhead press', weight: 49.5, reps: 5 },
    { name: 'Barbell row', weight: 69.5, reps: 8 },
    { name: 'Pull-up', weight: 22, reps: 8 },
  ];

  // 6M window: first ≈89 e1RM → last ≈96 → ~8% (Paper A2′′).
  const workoutHistory: LoggedWorkout[] = [
    benchSession(onDate('2026-08-19'), 82.5, 5, latestExtras),
    benchSession(onDate('2026-08-12'), 80, 5, latestExtras),
    benchSession(onDate('2026-08-05'), 80, 4, latestExtras),
    benchSession(onDate('2026-07-29'), 77.5, 5, latestExtras),
    benchSession(onDate('2026-03-01'), 76.5, 5, latestExtras),
  ];

  return {
    ...base,
    hasCompletedOnboarding: true,
    appearance: progressDemoUsesDarkAppearance() ? 'dark' : 'light',
    activePlanId: plan.id,
    plans: [plan],
    units: 'kg',
    bodyCheckIns: [
      newCheckIn({
        recordedAt: onDate('2026-07-01'),
        bodyweightKg: 83,
        waistCm: 83,
        shouldersCm: 128,
        chestCm: 102,
        hipCm: 98,
        neckCm: 38,
      }),
      newCheckIn({
        recordedAt: onDate('2026-07-31'),
        bodyweightKg: 82.4,
        waistCm: 81.5,
        shouldersCm: 129,
        chestCm: 104,
        hipCm: 97,
        neckCm: 38,
        thighLeftCm: 58,
        thighRightCm: 58.5,
      }),
      // Weight-only follow-up so index rows can show different Last dates.
      newCheckIn({
        recordedAt: onDate('2026-08-12'),
        bodyweightKg: 82.1,
      }),
    ],
    workoutHistory,
  };
}

export type ProgressDemoMode = 'index' | 'dark' | 'checkin' | 'dark-checkin' | 'lift' | 'body' | 'gadget';

/** Development only, and never saved (the store skips persisting while the flag is on); release builds ignore it. */
export function progressDemoMode(): ProgressDemoMode | null {
  if (!__DEV__) {
    return null;
  }
  const value = process.env.EXPO_PUBLIC_PROGRESS_DEMO;
  if (!value || value === '0') {
    return null;
  }
  if (value === '1') {
    return 'index';
  }
  if (
    value === 'dark' ||
    value === 'checkin' ||
    value === 'dark-checkin' ||
    value === 'lift' ||
    value === 'body' ||
    value === 'gadget'
  ) {
    return value;
  }
  return null;
}

export function shouldUseProgressDemo(): boolean {
  return progressDemoMode() != null;
}

export function progressDemoUsesDarkAppearance(): boolean {
  const mode = progressDemoMode();
  return mode === 'dark' || mode === 'dark-checkin';
}
