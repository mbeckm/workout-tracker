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

import { withLoggedTenRM } from '../domain/helpers';
import { newCheckIn, type BodyCheckIn } from '../domain/check-in';
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

import { loadSnapshot, saveSnapshot } from './persistence';
import { progressDemoSnapshot, shouldUseProgressDemo } from './progress-demo';
import { defaultSnapshot, type WorkoutSnapshot } from './snapshot';

export type PreviousExerciseLog = {
  completedAt: string;
  workoutTitle: string;
  sets: LoggedSet[];
};

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
  hasSeenPaywall: boolean;
  isPro: boolean;
  isHydrated: boolean;
  shouldOfferPaywall: boolean;
  lastCompletedWorkout: LoggedWorkout | null;
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
  dismissPaywall: () => void;
  setPro: (isPro: boolean) => void;
};

const WorkoutStoreContext = createContext<WorkoutStoreState | null>(null);

export function WorkoutProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<WorkoutSnapshot>(defaultSnapshot);
  const [isHydrated, setIsHydrated] = useState(false);
  const [lastCompletedWorkout, setLastCompletedWorkout] = useState<LoggedWorkout | null>(null);
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        return { ...current, plans };
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

  const dismissPaywall = useCallback(() => {
    setSnapshot((current) => ({
      ...current,
      hasSeenPaywall: true,
    }));
  }, []);

  const setPro = useCallback((isPro: boolean) => {
    setSnapshot((current) => ({
      ...current,
      isPro,
      hasSeenPaywall: isPro ? true : current.hasSeenPaywall,
    }));
  }, []);

  const activePlan =
    snapshot.plans.find((plan) => plan.id === snapshot.activePlanId) ?? snapshot.plans[0] ?? null;

  const shouldOfferPaywall =
    snapshot.workoutHistory.length > 0 && !snapshot.hasSeenPaywall && !snapshot.isPro;

  const value = useMemo<WorkoutStoreState>(() => {
    const loop = planLoopProgress(activePlan, snapshot.workoutHistory, snapshot.nextDayIndex);
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
      hasSeenPaywall: snapshot.hasSeenPaywall,
      isPro: snapshot.isPro,
      isHydrated,
      shouldOfferPaywall,
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
      dismissPaywall,
      setPro,
    };
  }, [
    snapshot,
    activePlan,
    isHydrated,
    shouldOfferPaywall,
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
    dismissPaywall,
    setPro,
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
