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

/** Paper judgment-journey fixture (Marvin) for Progress visual QA. */
export function progressDemoSnapshot(base: WorkoutSnapshot): WorkoutSnapshot {
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

export type ProgressDemoMode = 'index' | 'dark' | 'checkin' | 'dark-checkin' | 'lift' | 'body';

export function progressDemoMode(): ProgressDemoMode | null {
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
    value === 'body'
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
