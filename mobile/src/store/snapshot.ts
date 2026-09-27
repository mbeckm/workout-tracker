import type { AppearancePreference, ColorScheme } from '@/constants/theme';
import { migrateLegacyThigh, type BodyCheckIn } from '@/domain/check-in';
import { normalizeLogSession, type LogSession } from '@/domain/log-session';
import type {
  CustomExerciseDefinition,
  ExercisePrescription,
  LoggedExercise,
  LoggedWorkout,
  WorkoutPlan,
} from '@/domain/types';

export type WorkoutSnapshot = {
  plans: WorkoutPlan[];
  archivedPlans: WorkoutPlan[];
  activePlanId: string | null;
  customExercises: CustomExerciseDefinition[];
  workoutHistory: LoggedWorkout[];
  bodyCheckIns: BodyCheckIn[];
  nextDayIndex: number;
  units: 'kg' | 'lbs';
  appearance: AppearancePreference;
  /** Last observed OS light/dark — used when Appearance is poisoned by a prior override. */
  systemScheme: ColorScheme;
  hasCompletedOnboarding: boolean;
  /** When the one-time post-workout Pro offer actually rendered prices. Null = not yet. */
  postWorkoutPaywallShownAt: string | null;
  /** Cold-start cache of the RevenueCat entitlement. Only definite answers write it. */
  isPro: boolean;
  /** The workout open in the log, so a killed app resumes it. Null when none. */
  activeSession: LogSession | null;
};

export const defaultSnapshot: WorkoutSnapshot = {
  plans: [],
  archivedPlans: [],
  activePlanId: null,
  customExercises: [],
  workoutHistory: [],
  bodyCheckIns: [],
  nextDayIndex: 0,
  units: 'kg',
  appearance: 'system',
  systemScheme: 'light',
  hasCompletedOnboarding: false,
  postWorkoutPaywallShownAt: null,
  isPro: false,
  activeSession: null,
};

function normalizeAppearance(value: unknown): AppearancePreference {
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value;
  }
  return defaultSnapshot.appearance;
}

function normalizeSystemScheme(value: unknown): ColorScheme {
  if (value === 'light' || value === 'dark') {
    return value;
  }
  return defaultSnapshot.systemScheme;
}

type RawSnapshot = Partial<WorkoutSnapshot> & {
  routines?: WorkoutPlan[];
  archivedRoutines?: WorkoutPlan[];
  /** Pre-1.0: one flag for "post-workout offer consumed". */
  hasSeenPaywall?: boolean;
};

function normalizePostWorkoutPaywallShownAt(data: RawSnapshot, now: Date): string | null {
  if (typeof data.postWorkoutPaywallShownAt === 'string') {
    return data.postWorkoutPaywallShownAt;
  }
  // Legacy `hasSeenPaywall: true` becomes the migration time, so the offer isn't shown again.
  return data.hasSeenPaywall === true ? now.toISOString() : null;
}

/** 1.0 ships no exercise media; nothing reads saved URLs, so drop them on load. */
function withoutPrescriptionMedia(exercise: ExercisePrescription): ExercisePrescription {
  return { ...exercise, thumbnailURL: null, imageURL: null, videoURL: null, imageURLs: {} };
}

function withoutPlanMedia(plan: WorkoutPlan): WorkoutPlan {
  return {
    ...plan,
    days: (plan.days ?? []).map((day) => ({
      ...day,
      exercises: (day.exercises ?? []).map(withoutPrescriptionMedia),
    })),
  };
}

function withoutLoggedMedia(exercise: LoggedExercise): LoggedExercise {
  return { ...exercise, thumbnailURL: null, imageURL: null, imageURLs: {} };
}

function withoutWorkoutMedia(workout: LoggedWorkout): LoggedWorkout {
  return { ...workout, exercises: (workout.exercises ?? []).map(withoutLoggedMedia) };
}

export function normalizeSnapshot(raw: unknown, now: Date = new Date()): WorkoutSnapshot | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const data = raw as RawSnapshot;
  const plans = (data.plans ?? data.routines ?? []).map(withoutPlanMedia);
  const archivedPlans = (data.archivedPlans ?? data.archivedRoutines ?? []).map(withoutPlanMedia);
  const requestedId = data.activePlanId;
  const activePlanId =
    requestedId && plans.some((plan) => plan.id === requestedId)
      ? requestedId
      : (plans[0]?.id ?? null);

  return {
    ...defaultSnapshot,
    plans,
    archivedPlans,
    activePlanId,
    customExercises: data.customExercises ?? [],
    workoutHistory: (data.workoutHistory ?? []).map(withoutWorkoutMedia),
    bodyCheckIns: (data.bodyCheckIns ?? []).map((checkIn) =>
      migrateLegacyThigh(checkIn as BodyCheckIn & { thighCm?: number }),
    ),
    nextDayIndex: data.nextDayIndex ?? 0,
    units: data.units ?? defaultSnapshot.units,
    appearance: normalizeAppearance(data.appearance),
    systemScheme: normalizeSystemScheme(data.systemScheme),
    hasCompletedOnboarding: data.hasCompletedOnboarding ?? false,
    postWorkoutPaywallShownAt: normalizePostWorkoutPaywallShownAt(data, now),
    isPro: data.isPro === true,
    // Only live plans: a session for a deleted or archived plan/day is dropped.
    activeSession: normalizeLogSession(data.activeSession, plans),
  };
}
