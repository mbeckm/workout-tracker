import type { AppearancePreference, ColorScheme } from '@/constants/theme';
import { migrateLegacyThigh, type BodyCheckIn } from '@/domain/check-in';
import type {
  CustomExerciseDefinition,
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

export function normalizeSnapshot(raw: unknown, now: Date = new Date()): WorkoutSnapshot | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const data = raw as RawSnapshot;
  const plans = data.plans ?? data.routines ?? [];
  const archivedPlans = data.archivedPlans ?? data.archivedRoutines ?? [];
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
    workoutHistory: data.workoutHistory ?? [],
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
  };
}
