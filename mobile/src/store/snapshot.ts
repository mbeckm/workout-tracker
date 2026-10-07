import type { AppearancePreference, ColorScheme } from '@/constants/theme';
import { migrateLegacyThigh, type BodyCheckIn } from '@/domain/check-in';
import { normalizeBodyGoals, type BodyGoal } from '@/domain/body-goals';
import { DARK_FINISH, normalizeFinish, type Finish } from '@/domain/finish';
import { normalizeGoals, type Goal } from '@/domain/goals';
import { normalizeLoadSteps, type LoadSteps } from '@/domain/load-step';
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
  /** First name for Home's greeting, asked in onboarding and set in Settings. Empty = no name. */
  userName: string;
  /** When the one-time post-workout Pro offer actually rendered prices. Null = not yet. */
  postWorkoutPaywallShownAt: string | null;
  /** Cold-start cache of the RevenueCat entitlement. Only definite answers write it. */
  isPro: boolean;
  /** The workout open in the log, so a killed app resumes it. Null when none. */
  activeSession: LogSession | null;
  /**
   * Done's moment facts already shown (`First workout`, `10th workout`), each with the workout
   * that earned it. A moment fires once (trim-ui §12): deleting workouts never re-earns it.
   */
  milestonesShown: Record<string, string>;
  /** Lift goals (PRODUCT-DECISIONS 63): one per lift, up to 3 pinned to Progress. */
  goals: Goal[];
  /** Body goals (PRODUCT-DECISIONS 65): one per measurement, on its body detail. */
  bodyGoals: BodyGoal[];
  /** The device's finish (PLAN §4.5), picked from the menu. */
  finish: Finish;
  /** Device sounds (D14). The silent switch still silences them. */
  soundsOn: boolean;
  /** D2: the one-time `appearance` → `finish` migration has run (or was never needed). */
  appearanceMigratedToFinish: boolean;
  /** ISO week keys whose week report already played (D15), so it shows once. */
  weekMomentsShown: string[];
  /** Wheel steps chosen on the drum, saved per exercise (PRODUCT-DECISIONS 80). */
  loadSteps: LoadSteps;
  /** The guided tour has ended (finished or skipped) and given Graphite (decision 85). */
  tourDone: boolean;
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
  userName: '',
  postWorkoutPaywallShownAt: null,
  isPro: false,
  activeSession: null,
  milestonesShown: {},
  goals: [],
  bodyGoals: [],
  finish: '212',
  soundsOn: true,
  appearanceMigratedToFinish: false,
  weekMomentsShown: [],
  loadSteps: {},
  tourDone: false,
};

function normalizeAppearance(value: unknown): AppearancePreference {
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value;
  }
  return defaultSnapshot.appearance;
}

function normalizeWeekKeys(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((key): key is string => typeof key === 'string') : [];
}

function normalizeMilestones(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

/** Longest name kept; a greeting has no room for more. */
export const USER_NAME_MAX_LENGTH = 40;

export function normalizeUserName(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().slice(0, USER_NAME_MAX_LENGTH).trim();
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
    // Snapshots from before the name have none.
    userName: normalizeUserName(data.userName),
    postWorkoutPaywallShownAt: normalizePostWorkoutPaywallShownAt(data, now),
    isPro: data.isPro === true,
    // Only live plans: a session for a deleted or archived plan/day is dropped.
    activeSession: normalizeLogSession(data.activeSession, plans),
    milestonesShown: normalizeMilestones(data.milestonesShown),
    // Snapshots from before goals have none.
    goals: normalizeGoals(data.goals),
    bodyGoals: normalizeBodyGoals(data.bodyGoals),
    // Snapshots from before the Gadget redesign have none of these.
    finish: normalizeFinish(data.finish),
    soundsOn: data.soundsOn !== false,
    appearanceMigratedToFinish: data.appearanceMigratedToFinish === true,
    weekMomentsShown: normalizeWeekKeys(data.weekMomentsShown),
    // Snapshots from before chosen wheel steps have none.
    loadSteps: normalizeLoadSteps(data.loadSteps),
    // Owners from before the tour never get it, and keep Graphite.
    tourDone: typeof data.tourDone === 'boolean' ? data.tourDone : data.hasCompletedOnboarding === true,
  };
}

/**
 * D2, once: a user who saw Trim dark (`dark`, or `system` on a dark phone) gets 101 Graphite.
 * Only after onboarding; new installs set the flag when onboarding completes. `appearance` stays.
 */
export function withAppearanceMigratedToFinish(
  snapshot: WorkoutSnapshot,
  systemScheme: ColorScheme,
): WorkoutSnapshot {
  if (!snapshot.hasCompletedOnboarding || snapshot.appearanceMigratedToFinish) {
    return snapshot;
  }
  const sawDark =
    snapshot.appearance === 'dark' || (snapshot.appearance === 'system' && systemScheme === 'dark');
  return {
    ...snapshot,
    finish: sawDark ? DARK_FINISH : snapshot.finish,
    appearanceMigratedToFinish: true,
  };
}
