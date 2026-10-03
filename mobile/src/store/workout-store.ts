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
import { Appearance, AppState } from 'react-native';

import type { Finish } from '../domain/finish';
import { withLoggedTenRM, workoutMilestone } from '../domain/helpers';
import { newCheckIn, type BodyCheckIn } from '../domain/check-in';
import {
  withBodyGoal,
  withReachedBodyGoals,
  type BodyGoal,
  type BodyGoalInput,
} from '../domain/body-goals';
import { MAX_PINNED_GOALS, withGoal, withReachedGoals, type Goal, type GoalInput } from '../domain/goals';
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
import { homeDemoMode, homeDemoSnapshot } from './home-demo';
import { progressDemoSnapshot, shouldUseProgressDemo } from './progress-demo';
import {
  defaultSnapshot,
  normalizeUserName,
  withAppearanceMigratedToFinish,
  type WorkoutSnapshot,
} from './snapshot';

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

export type RemovedPlan = { plan: WorkoutPlan; index: number; wasActive: boolean };

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
  /** First name for Home's greeting. Empty when the user gave none. */
  userName: string;
  postWorkoutPaywallShownAt: string | null;
  /** Cached entitlement; written only by `applyEntitlement`. */
  isPro: boolean;
  /** Known after the first entitlement sync this launch; null when not Pro or not known yet. */
  proPeriod: ProPeriod | null;
  /** When the current Pro period ends, and whether it renews then. Null when not known. */
  proRenewal: { expiresAt: string; willRenew: boolean } | null;
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
  /** Applies `update` to the plan as it is now (Undo runs later, after other edits). */
  editPlan: (planId: string, update: (plan: WorkoutPlan) => WorkoutPlan) => void;
  /** Undo for `deletePlan`: back at its old place in the list, active again if it was. */
  restorePlan: (removed: RemovedPlan) => void;
  /** Undo for a delete that dropped the running workout. Never replaces a newer one. */
  restoreSession: (session: LogSession) => void;
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
  /** Trimmed and capped; an empty name clears it. */
  setUserName: (name: string) => void;
  completeOnboarding: () => void;
  /** Call once the paywall has rendered offers. Only `post_workout` is recorded. */
  markPaywallShown: (reason: ProReason) => void;
  /** Ignores `unknown`, so offline or an SDK error never downgrades a cached Pro user. */
  applyEntitlement: (entitlement: Entitlement) => void;
  /** Done's moment fact for this workout, shown once ever: null once another workout had it. */
  milestoneFor: (workout: LoggedWorkout) => string | null;
  /** Records that `milestone` was shown for `workoutId` (first claim wins). */
  claimMilestone: (milestone: string, workoutId: string) => void;
  /** Lift goals (PRODUCT-DECISIONS 63). Selectors live in `domain/goals.ts`. */
  goals: Goal[];
  /** Creates a lift's goal or changes its target (goal sheet). */
  setGoal: (input: GoalInput) => void;
  /** Removes a goal at once; pass the result to `restoreGoal` for Undo. */
  removeGoal: (id: string) => RemovedGoal | null;
  restoreGoal: (removed: RemovedGoal) => void;
  /** Unpin keeps the goal on its lift's detail. Pinning needs a free slot. */
  setGoalPinned: (id: string, pinned: boolean) => void;
  /** Body goals (PRODUCT-DECISIONS 65). Selectors live in `domain/body-goals.ts`. */
  bodyGoals: BodyGoal[];
  /** Creates a measurement's goal or changes its target (goal sheet). */
  setBodyGoal: (input: BodyGoalInput) => void;
  /** Removes a body goal at once; pass the result to `restoreBodyGoal` for Undo. */
  removeBodyGoal: (id: string) => RemovedBodyGoal | null;
  restoreBodyGoal: (removed: RemovedBodyGoal) => void;
  /** The device's finish (PLAN §4.5). */
  finish: Finish;
  setFinish: (finish: Finish) => void;
  /** Device sounds (D14); haptics don't depend on it. */
  soundsOn: boolean;
  setSoundsOn: (soundsOn: boolean) => void;
  /** ISO week keys whose week report already played (D15). */
  weekMomentsShown: string[];
  markWeekMomentShown: (weekKey: string) => void;
};

export type RemovedGoal = { goal: Goal; index: number };
export type RemovedBodyGoal = { goal: BodyGoal; index: number };

const WorkoutStoreContext = createContext<WorkoutStoreState | null>(null);

export function WorkoutProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<WorkoutSnapshot>(defaultSnapshot);
  const [isHydrated, setIsHydrated] = useState(false);
  const [lastCompletedWorkout, setLastCompletedWorkout] = useState<LoggedWorkout | null>(null);
  const [proPeriod, setProPeriod] = useState<ProPeriod | null>(null);
  const [proRenewal, setProRenewal] = useState<WorkoutStoreState['proRenewal']>(null);
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapshotRef = useRef(snapshot);
  const hydratedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const stored = await loadSnapshot();
      if (cancelled) {
        return;
      }
      // D2: read the OS scheme only (never set it); the persisted copy covers a null answer.
      const osScheme = Appearance.getColorScheme();
      const loaded = stored
        ? withAppearanceMigratedToFinish(
            stored,
            osScheme === 'dark' || osScheme === 'light' ? osScheme : stored.systemScheme,
          )
        : null;

      const homeDemo = homeDemoMode();
      if (homeDemo) {
        // Dev only, never saved (see the persistence effects below).
        setSnapshot(homeDemoSnapshot(loaded ?? defaultSnapshot, homeDemo));
      } else if (loaded) {
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
      if (state === 'active' || !hydratedRef.current || homeDemoMode() || shouldUseProgressDemo()) {
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
    // The demo fixtures (Home, Progress) must never overwrite the user's saved data.
    if (!isHydrated || homeDemoMode() || shouldUseProgressDemo()) {
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

  const editPlan = useCallback((planId: string, update: (plan: WorkoutPlan) => WorkoutPlan) => {
    setSnapshot((current) => {
      const index = current.plans.findIndex((item) => item.id === planId);
      const existing = current.plans[index];
      if (!existing) {
        return current;
      }
      const plans = [...current.plans];
      plans[index] = update(existing);
      return { ...current, plans, activeSession: sessionStillValid(current.activeSession, plans) };
    });
  }, []);

  const restorePlan = useCallback(({ plan, index, wasActive }: RemovedPlan) => {
    setSnapshot((current) => {
      const others = current.plans.filter((item) => item.id !== plan.id);
      const at = Math.min(Math.max(0, index), others.length);
      const plans = [...others.slice(0, at), plan, ...others.slice(at)];
      return {
        ...current,
        plans,
        archivedPlans: current.archivedPlans.filter((item) => item.id !== plan.id),
        activePlanId: wasActive || current.activePlanId == null ? plan.id : current.activePlanId,
      };
    });
  }, []);

  const restoreSession = useCallback((session: LogSession) => {
    setSnapshot((current) => {
      if (current.activeSession != null) {
        return current;
      }
      const restored = sessionStillValid(session, current.plans);
      return restored ? { ...current, activeSession: restored } : current;
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
      // A goal is reached by the workout whose estimated 1RM first meets it.
      goals: withReachedGoals(current.goals, workout),
    }));

    return workout;
  }, []);

  const setGoal = useCallback((input: GoalInput) => {
    setSnapshot((current) => ({ ...current, goals: withGoal(current.goals, input) }));
  }, []);

  const removeGoal = useCallback(
    (id: string): RemovedGoal | null => {
      const index = snapshot.goals.findIndex((goal) => goal.id === id);
      if (index === -1) {
        return null;
      }
      const removed = { goal: snapshot.goals[index], index };
      setSnapshot((current) => ({ ...current, goals: current.goals.filter((goal) => goal.id !== id) }));
      return removed;
    },
    [snapshot.goals],
  );

  const restoreGoal = useCallback(({ goal, index }: RemovedGoal) => {
    setSnapshot((current) => {
      if (current.goals.some((item) => item.id === goal.id)) {
        return current;
      }
      // Back where it was; it re-pins only if a slot is still free.
      const pinned =
        goal.pinned && current.goals.filter((item) => item.pinned).length < MAX_PINNED_GOALS;
      const at = Math.min(index, current.goals.length);
      return {
        ...current,
        goals: [...current.goals.slice(0, at), { ...goal, pinned }, ...current.goals.slice(at)],
      };
    });
  }, []);

  const setGoalPinned = useCallback((id: string, pinned: boolean) => {
    setSnapshot((current) => {
      if (pinned && current.goals.filter((goal) => goal.pinned).length >= MAX_PINNED_GOALS) {
        return current;
      }
      return {
        ...current,
        goals: current.goals.map((goal) => (goal.id === id ? { ...goal, pinned } : goal)),
      };
    });
  }, []);

  const setBodyGoal = useCallback((input: BodyGoalInput) => {
    setSnapshot((current) => ({ ...current, bodyGoals: withBodyGoal(current.bodyGoals, input) }));
  }, []);

  const removeBodyGoal = useCallback(
    (id: string): RemovedBodyGoal | null => {
      const index = snapshot.bodyGoals.findIndex((goal) => goal.id === id);
      if (index === -1) {
        return null;
      }
      const removed = { goal: snapshot.bodyGoals[index], index };
      setSnapshot((current) => ({
        ...current,
        bodyGoals: current.bodyGoals.filter((goal) => goal.id !== id),
      }));
      return removed;
    },
    [snapshot.bodyGoals],
  );

  const restoreBodyGoal = useCallback(({ goal, index }: RemovedBodyGoal) => {
    setSnapshot((current) => {
      if (current.bodyGoals.some((item) => item.id === goal.id || item.metric === goal.metric)) {
        return current;
      }
      const at = Math.min(index, current.bodyGoals.length);
      return {
        ...current,
        bodyGoals: [...current.bodyGoals.slice(0, at), goal, ...current.bodyGoals.slice(at)],
      };
    });
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
          // A body goal is reached by the check-in that first meets it.
          bodyGoals: withReachedBodyGoals(current.bodyGoals, checkIn),
        };
      });

      return saved ?? newCheckIn(input);
    },
    [],
  );

  const saveLogSession = useCallback((session: LogSession, options?: { flush?: boolean }) => {
    setSnapshot((current) => {
      const next = { ...current, activeSession: session };
      if (options?.flush && !homeDemoMode()) {
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

  const setUserName = useCallback((name: string) => {
    const userName = normalizeUserName(name);
    setSnapshot((current) => (current.userName === userName ? current : { ...current, userName }));
  }, []);

  const completeOnboarding = useCallback(() => {
    setSnapshot((current) => ({
      ...current,
      hasCompletedOnboarding: true,
      // New installs pick a finish in onboarding; there's no old appearance to migrate.
      appearanceMigratedToFinish: true,
    }));
  }, []);

  const setFinish = useCallback((finish: Finish) => {
    setSnapshot((current) => (current.finish === finish ? current : { ...current, finish }));
  }, []);

  const setSoundsOn = useCallback((soundsOn: boolean) => {
    setSnapshot((current) => (current.soundsOn === soundsOn ? current : { ...current, soundsOn }));
  }, []);

  const markWeekMomentShown = useCallback((weekKey: string) => {
    setSnapshot((current) =>
      current.weekMomentsShown.includes(weekKey)
        ? current
        : { ...current, weekMomentsShown: [...current.weekMomentsShown, weekKey] },
    );
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

  const milestoneFor = useCallback(
    (workout: LoggedWorkout) => {
      const milestone = workoutMilestone(workout, snapshot.workoutHistory);
      if (!milestone) {
        return null;
      }
      const owner = snapshot.milestonesShown[milestone];
      return owner == null || owner === workout.id ? milestone : null;
    },
    [snapshot.milestonesShown, snapshot.workoutHistory],
  );

  const claimMilestone = useCallback((milestone: string, workoutId: string) => {
    setSnapshot((current) =>
      current.milestonesShown[milestone] != null
        ? current
        : { ...current, milestonesShown: { ...current.milestonesShown, [milestone]: workoutId } },
    );
  }, []);

  const applyEntitlement = useCallback((entitlement: Entitlement) => {
    // A home demo (development) pins its own Pro state, so the gates act on the fixture.
    if (entitlement.status === 'unknown' || homeDemoMode()) {
      return;
    }
    const isPro = entitlement.status === 'pro';
    setProPeriod(isPro ? entitlement.period : null);
    setProRenewal(
      isPro && entitlement.expiresAt
        ? { expiresAt: entitlement.expiresAt, willRenew: entitlement.willRenew !== false }
        : null,
    );
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
      userName: snapshot.userName,
      postWorkoutPaywallShownAt: snapshot.postWorkoutPaywallShownAt,
      isPro: snapshot.isPro,
      proPeriod: snapshot.isPro ? proPeriod : null,
      proRenewal: snapshot.isPro ? proRenewal : null,
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
      editPlan,
      restorePlan,
      restoreSession,
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
      setUserName,
      completeOnboarding,
      markPaywallShown,
      applyEntitlement,
      milestoneFor,
      claimMilestone,
      goals: snapshot.goals,
      setGoal,
      removeGoal,
      restoreGoal,
      setGoalPinned,
      bodyGoals: snapshot.bodyGoals,
      setBodyGoal,
      removeBodyGoal,
      restoreBodyGoal,
      finish: snapshot.finish,
      setFinish,
      soundsOn: snapshot.soundsOn,
      setSoundsOn,
      weekMomentsShown: snapshot.weekMomentsShown,
      markWeekMomentShown,
    };
  }, [
    snapshot,
    activePlan,
    proPeriod,
    proRenewal,
    isHydrated,
    shouldOfferPostWorkoutPaywall,
    lastCompletedWorkout,
    savePlan,
    updatePlan,
    deletePlan,
    editPlan,
    restorePlan,
    restoreSession,
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
    setUserName,
    completeOnboarding,
    markPaywallShown,
    applyEntitlement,
    milestoneFor,
    claimMilestone,
    saveLogSession,
    clearLogSession,
    setGoal,
    removeGoal,
    restoreGoal,
    setGoalPinned,
    setBodyGoal,
    removeBodyGoal,
    restoreBodyGoal,
    setFinish,
    setSoundsOn,
    markWeekMomentShown,
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
