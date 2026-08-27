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
  hasSeenPaywall: boolean;
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
  hasSeenPaywall: false,
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
};

export function normalizeSnapshot(raw: unknown): WorkoutSnapshot | null {
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
    hasSeenPaywall: data.hasSeenPaywall ?? false,
    isPro: data.isPro ?? false,
  };
}
