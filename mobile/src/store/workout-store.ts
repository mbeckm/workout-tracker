import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { withLoggedTenRM } from '../domain/helpers';
import { newCheckIn, type BodyCheckIn } from '../domain/check-in';
import {
  clearedSession,
  loggedSetCount,
  sessionAfterWorkout,
  sessionStillValid,
  type LogSession,
} from '../domain/log-session';
import { planLoopProgress } from '../domain/plan-loop';
import type {
  CustomExerciseDefinition,
  LoggedExercise,
  LoggedSet,
  LoggedWorkout,
  WorkoutPlan,
} from '../domain/types';
import { newId, normalizedStatsKey } from '../domain/types';
import type { AppearancePreference, ColorScheme } from '@/constants/theme';
import type { Entitlement, ProPeriod } from '@/purchases/entitlement';
import { setProCache, type ProReason } from '@/purchases/pro-gate';

import { loadSnapshot, saveSnapshot } from './persistence';
import { progressDemoSnapshot, shouldUseProgressDemo } from './progress-demo';
import { defaultSnapshot, type WorkoutSnapshot } from './snapshot';

export type PreviousExerciseLog = {
  completedAt: string;
  workoutTitle: string;
  sets: LoggedSet[];
};

/**
 * The workout currently open in the log, if any. Home shows Resume for it.
 * Derived from the persisted `logSession`; null when its plan or day is gone.
 */
export type ActiveSession = {
  planId: string;
  dayId: string;
  startedAt: string;
  loggedSetCount: number;
  /** ISO time of the last set change. */
  updatedAt?: string;
};

export type { LogSession } from '../domain/log-session';

type CompleteWorkoutInput = {
  title: string;
  exercises: LoggedExercise[];
  durationMinutes: number;
  startedAt: string;
  planId?: string;
  dayId?: string;
};

type WorkoutStoreState = {
  plans: WorkoutPlan[];
  archivedPlans: WorkoutPlan[];
  activePlanId: string | null;
  activePlan: WorkoutPlan | null;
  customExercises: CustomExerciseDefinition[];
  workoutHistory: LoggedWorkout[];
  bodyCheckIns: BodyCheckIn[];
  completedDayIds: string[];
  nextDayIndex: number;
  units: 'kg' | 'lbs';
  appearance: AppearancePreference;
  systemScheme: ColorScheme;
  hasCompletedOnboarding: boolean;
  postWorkoutPaywallShownAt: string | null;
  /** Cached entitlement; written only by `applyEntitlement`. */
  isPro: boolean;
  /** Known after the first entitlement sync this launch; null when not Pro or not known yet. */
  proPeriod: ProPeriod | null;
  isHydrated: boolean;
  shouldOfferPostWorkoutPaywall: boolean;
  lastCompletedWorkout: LoggedWorkout | null;
  /** In-progress workout summary for Home (Resume). */
  activeSession: ActiveSession | null;
  /** Full persisted log state (drafts, exercise, rest). Only the log reads this. */
  logSession: LogSession | null;
  /** Written by the log on every set change. `flush` also writes storage now (app backgrounding). */
  saveLogSession: (session: LogSession, options?: { flush?: boolean }) => void;
  /** Finish or discard. With `match`, clears only that plan/day's session. */
  clearLogSession: (match?: { planId: string; dayId: string }) => void;
  savePlan: (plan: WorkoutPlan, options?: { activate?: boolean }) => void;
  updatePlan: (plan: WorkoutPlan) => void;
  deletePlan: (plan: WorkoutPlan, options?: { archive?: boolean }) => void;
  activatePlan: (plan: WorkoutPlan) => void;
  saveCustomExercise: (exercise: CustomExerciseDefinition) => void;
  previousSetsForExercise: (name: string) => LoggedSet[];
  previousLogForExercise: (name: string) => PreviousExerciseLog | null;
  completeWorkout: (input: CompleteWorkoutInput) => LoggedWorkout;
  deleteWorkout: (id: string) => void;
  clearWorkoutHistory: () => void;
  saveCheckIn: (input: Partial<BodyCheckIn> & { recordedAt?: string }) => BodyCheckIn;
  setUnits: (units: 'kg' | 'lbs') => void;
  setAppearance: (appearance: AppearancePreference) => void;
  setSystemScheme: (systemScheme: ColorScheme) => void;
  completeOnboarding: () => void;
  /** Call once the paywall has rendered offers. Only `post_workout` is recorded. */
  markPaywallShown: (reason: ProReason) => void;
  /** Ignores `unknown`, so offline or an SDK error never downgrades a cached Pro user. */
  applyEntitlement: (entitlement: Entitlement) => void;
};

const WorkoutStoreContext = createContext<WorkoutStoreState | null>(null);

export function WorkoutProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<WorkoutSnapshot>(defaultSnapshot);
  const [isHydrated, setIsHydrated] = useState(false);
  const [lastCompletedWorkout, setLastCompletedWorkout] = useState<LoggedWorkout | null>(null);
  const [proPeriod, setProPeriod] = useState<ProPeriod | null>(null);
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapshotRef = useRef(snapshot);
  const hydratedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const loaded = await loadSnapshot();
      if (cancelled) {
        return;
      }

      if (loaded) {
        setSnapshot(shouldUseProgressDemo() ? progressDemoSnapshot(loaded) : loaded);
      } else if (shouldUseProgressDemo()) {
        setSnapshot(progressDemoSnapshot(defaultSnapshot));
      }

      setIsHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    snapshotRef.current = snapshot;
    hydratedRef.current = isHydrated;
  }, [isHydrated, snapshot]);

  // iOS may kill a backgrounded app without warning; don't leave the last 300ms unsaved.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' || !hydratedRef.current) {
        return;
      }
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current);
        persistTimeoutRef.current = null;
      }
      void saveSnapshot(snapshotRef.current);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (persistTimeoutRef.current) {
      clearTimeout(persistTimeoutRef.current);
    }

    persistTimeoutRef.current = setTimeout(() => {
      void saveSnapshot(snapshot);
    }, 300);

    return () => {
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current);
      }
    };
  }, [isHydrated, snapshot]);

  const savePlan = useCallback((plan: WorkoutPlan, options?: { activate?: boolean }) => {
    setSnapshot((current) => {
      const plans = [plan, ...current.plans.filter((item) => item.id !== plan.id)];
      const archivedPlans = current.archivedPlans.filter((item) => item.id !== plan.id);
      const shouldActivate = options?.activate === true || current.activePlanId == null;

      return {
        ...current,
        plans,
        archivedPlans,
        activePlanId: shouldActivate ? plan.id : current.activePlanId,
      };
    });
  }, []);

  const updatePlan = useCallback((plan: WorkoutPlan) => {
    setSnapshot((current) => {
      const planIndex = current.plans.findIndex((item) => item.id === plan.id);
      if (planIndex >= 0) {
        const plans = [...current.plans];
        plans[planIndex] = plan;
        return { ...current, plans, activeSession: sessionStillValid(current.activeSession, plans) };
      }

      const archivedIndex = current.archivedPlans.findIndex((item) => item.id === plan.id);
      if (archivedIndex >= 0) {
        const archivedPlans = [...current.archivedPlans];
        archivedPlans[archivedIndex] = plan;
        return { ...current, archivedPlans };
      }

      return {
        ...current,
        plans: [plan, ...current.plans],
        activePlanId: current.activePlanId ?? plan.id,
      };
    });
  }, []);

  const deletePlan = useCallback((plan: WorkoutPlan, options?: { archive?: boolean }) => {
    setSnapshot((current) => {
      const plans = current.plans.filter((item) => item.id !== plan.id);
      const archivedPlans =
        options?.archive === false
          ? current.archivedPlans.filter((item) => item.id !== plan.id)
          : [plan, ...current.archivedPlans.filter((item) => item.id !== plan.id)];
      const activePlanId =
        current.activePlanId === plan.id ? (plans[0]?.id ?? null) : current.activePlanId;

      return {
        ...current,
        plans,
        archivedPlans,
        activePlanId,
        activeSession: sessionStillValid(current.activeSession, plans),
      };
    });
  }, []);

  const activatePlan = useCallback((plan: WorkoutPlan) => {
    setSnapshot((current) => {
      const plans = current.plans.some((item) => item.id === plan.id)
        ? current.plans.map((item) => (item.id === plan.id ? plan : item))
        : [plan, ...current.plans];

      return {
        ...current,
        plans,
        archivedPlans: current.archivedPlans.filter((item) => item.id !== plan.id),
        activePlanId: plan.id,
      };
    });
  }, []);

  const saveCustomExercise = useCallback((exercise: CustomExerciseDefinition) => {
    const now = new Date().toISOString();
    const updatedExercise: CustomExerciseDefinition = {
      ...exercise,
      updatedAt: now,
      isArchived: false,
    };

    setSnapshot((current) => {
      const customExercises = [
        updatedExercise,
        ...current.customExercises.filter(
          (item) =>
            item.id !== exercise.id &&
            item.name.trim().toLowerCase() !== exercise.name.trim().toLowerCase(),
        ),
      ];

      return {
        ...current,
        customExercises,
      };
    });
  }, []);

  const previousSetsForExercise = useCallback(
    (name: string): LoggedSet[] => {
      const key = normalizedStatsKey(name);

      for (const workout of snapshot.workoutHistory) {
        const match = workout.exercises.find(
          (exercise) => normalizedStatsKey(exercise.exerciseName) === key,
        );

        if (match) {
          return match.sets;
        }
      }

      return [];
    },
    [snapshot.workoutHistory],
  );

  const previousLogForExercise = useCallback(
    (name: string): PreviousExerciseLog | null => {
      const key = normalizedStatsKey(name);

      for (const workout of snapshot.workoutHistory) {
        const match = workout.exercises.find(
          (exercise) => normalizedStatsKey(exercise.exerciseName) === key,
        );

        if (match) {
          return {
            completedAt: workout.completedAt,
            workoutTitle: workout.title,
            sets: match.sets,
          };
        }
      }

      return null;
    },
    [snapshot.workoutHistory],
  );

  const completeWorkout = useCallback((input: CompleteWorkoutInput): LoggedWorkout => {
    const exercises = input.exercises
      .filter((exercise) => exercise.sets.length > 0)
      .map((exercise) => withLoggedTenRM(exercise));
    const setCount = exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);

    const workout: LoggedWorkout = {
      id: newId(),
      title: input.title,
      completedAt: new Date().toISOString(),
      durationMinutes: Math.max(0, input.durationMinutes),
      exerciseCount: exercises.length,
      setCount,
      exercises,
      planId: input.planId ?? null,
      dayId: input.dayId ?? null,
    };

    setLastCompletedWorkout(workout);
    setSnapshot((current) => ({
      ...current,
      workoutHistory: [workout, ...current.workoutHistory],
      activeSession: sessionAfterWorkout(current.activeSession, workout),
    }));

    return workout;
  }, []);

  const deleteWorkout = useCallback((id: string) => {
    setSnapshot((current) => ({
      ...current,
      workoutHistory: current.workoutHistory.filter((item) => item.id !== id),
    }));
  }, []);

  const clearWorkoutHistory = useCallback(() => {
    setSnapshot((current) => ({
      ...current,
      workoutHistory: [],
    }));
  }, []);

  const saveCheckIn = useCallback(
    (input: Partial<BodyCheckIn> & { recordedAt?: string }): BodyCheckIn => {
      let saved: BodyCheckIn | null = null;

      setSnapshot((current) => {
        const checkIn: BodyCheckIn = input.id
          ? {
              ...(current.bodyCheckIns.find((item) => item.id === input.id) ?? newCheckIn()),
              ...input,
              id: input.id,
            }
          : newCheckIn(input);

        const existingIndex = current.bodyCheckIns.findIndex((item) => item.id === checkIn.id);
        const bodyCheckIns =
          existingIndex >= 0
            ? current.bodyCheckIns.map((item, index) => (index === existingIndex ? checkIn : item))
            : [checkIn, ...current.bodyCheckIns].sort((left, right) =>
                right.recordedAt.localeCompare(left.recordedAt),
              );

        saved = checkIn;

        return {
          ...current,
          bodyCheckIns,
        };
      });

      return saved ?? newCheckIn(input);
    },
    [],
  );

  const saveLogSession = useCallback((session: LogSession, options?: { flush?: boolean }) => {
    setSnapshot((current) => {
      const next = { ...current, activeSession: session };
      if (options?.flush) {
        // Backgrounding: write now instead of waiting for the debounce. Idempotent.
        void saveSnapshot(next);
      }
      return next;
    });
  }, []);

  const clearLogSession = useCallback((match?: { planId: string; dayId: string }) => {
    setSnapshot((current) => {
      const activeSession = clearedSession(current.activeSession, match);
      return activeSession === current.activeSession ? current : { ...current, activeSession };
    });
  }, []);

  const setUnits = useCallback((units: 'kg' | 'lbs') => {
    setSnapshot((current) => ({
      ...current,
      units,
    }));
  }, []);

  const setAppearance = useCallback((appearance: AppearancePreference) => {
    setSnapshot((current) => ({
      ...current,
      appearance,
    }));
  }, []);

  const setSystemScheme = useCallback((systemScheme: ColorScheme) => {
    setSnapshot((current) =>
      current.systemScheme === systemScheme ? current : { ...current, systemScheme },
    );
  }, []);

  const completeOnboarding = useCallback(() => {
    setSnapshot((current) => ({
      ...current,
      hasCompletedOnboarding: true,
    }));
  }, []);

  const markPaywallShown = useCallback((reason: ProReason) => {
    if (reason !== 'post_workout') {
      return;
    }
    setSnapshot((current) =>
      current.postWorkoutPaywallShownAt != null
        ? current
        : { ...current, postWorkoutPaywallShownAt: new Date().toISOString() },
    );
  }, []);

  const applyEntitlement = useCallback((entitlement: Entitlement) => {
    if (entitlement.status === 'unknown') {
      return;
    }
    const isPro = entitlement.status === 'pro';
    setProPeriod(isPro ? entitlement.period : null);
    setSnapshot((current) => (current.isPro === isPro ? current : { ...current, isPro }));
  }, []);

  useEffect(() => {
    setProCache(snapshot.isPro);
  }, [snapshot.isPro]);

  const activePlan =
    snapshot.plans.find((plan) => plan.id === snapshot.activePlanId) ?? snapshot.plans[0] ?? null;

  const shouldOfferPostWorkoutPaywall =
    snapshot.workoutHistory.length > 0 &&
    !snapshot.isPro &&
    snapshot.postWorkoutPaywallShownAt == null;

  const value = useMemo<WorkoutStoreState>(() => {
    const loop = planLoopProgress(activePlan, snapshot.workoutHistory, snapshot.nextDayIndex);
    const logSession = sessionStillValid(snapshot.activeSession, snapshot.plans);
    const activeSession: ActiveSession | null = logSession
      ? {
          planId: logSession.planId,
          dayId: logSession.dayId,
          startedAt: logSession.startedAt,
          loggedSetCount: loggedSetCount(logSession.drafts),
          updatedAt: logSession.updatedAt,
        }
      : null;
    return {
      plans: snapshot.plans,
      archivedPlans: snapshot.archivedPlans,
      activePlanId: activePlan?.id ?? null,
      activePlan,
      customExercises: snapshot.customExercises,
      workoutHistory: snapshot.workoutHistory,
      bodyCheckIns: snapshot.bodyCheckIns,
      completedDayIds: loop.completedDayIds,
      nextDayIndex: loop.nextDayIndex,
      units: snapshot.units,
      appearance: snapshot.appearance,
      systemScheme: snapshot.systemScheme,
      hasCompletedOnboarding: snapshot.hasCompletedOnboarding,
      postWorkoutPaywallShownAt: snapshot.postWorkoutPaywallShownAt,
      isPro: snapshot.isPro,
      proPeriod: snapshot.isPro ? proPeriod : null,
      isHydrated,
      shouldOfferPostWorkoutPaywall,
      lastCompletedWorkout,
      activeSession,
      logSession,
      saveLogSession,
      clearLogSession,
      savePlan,
      updatePlan,
      deletePlan,
      activatePlan,
      saveCustomExercise,
      previousSetsForExercise,
      previousLogForExercise,
      completeWorkout,
      deleteWorkout,
      clearWorkoutHistory,
      saveCheckIn,
      setUnits,
      setAppearance,
      setSystemScheme,
      completeOnboarding,
      markPaywallShown,
      applyEntitlement,
    };
  }, [
    snapshot,
    activePlan,
    proPeriod,
    isHydrated,
    shouldOfferPostWorkoutPaywall,
    lastCompletedWorkout,
    savePlan,
    updatePlan,
    deletePlan,
    activatePlan,
    saveCustomExercise,
    previousSetsForExercise,
    previousLogForExercise,
    completeWorkout,
    deleteWorkout,
    clearWorkoutHistory,
    saveCheckIn,
    setUnits,
    setAppearance,
    setSystemScheme,
    completeOnboarding,
    markPaywallShown,
    applyEntitlement,
    saveLogSession,
    clearLogSession,
  ]);

  return createElement(WorkoutStoreContext.Provider, { value }, children);
}

export function useWorkoutStore(): WorkoutStoreState {
  const context = useContext(WorkoutStoreContext);

  if (!context) {
    throw new Error('useWorkoutStore must be used within a WorkoutProvider');
  }

  return context;
}
