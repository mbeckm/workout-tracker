import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { track } from '@/analytics/analytics';
import { offlineCatalogExercises } from '@/catalog';
import { confirmAction } from '@/components/confirm-action';
import { useDevice } from '@/device/device-context';
import type { LogMode } from '@/device/device-state';
import { useHaptics } from '@/device/haptics';
import { clonePrescription, durationIsMinutes, formatSetsCount, withDay } from '@/domain/helpers';
import {
  buildDrafts,
  findSessionDay,
  loggedSetCount,
  openLogSession,
  prefillTargets,
  sessionDurationMinutes,
  unloggedSetCount,
  type DraftExercise,
  type LogSession,
  type OpenedLog,
  type RestWindow,
} from '@/domain/log-session';
import { restSecondsForExercise } from '@/domain/rest';
import { workoutPersonalBests } from '@/domain/set-lines';
import { loadIncrement, targetsFromHistory, type SetTarget } from '@/domain/targets';
import { newId, type ExercisePrescription, type LoggedExercise, type LoggedSet, type WorkoutDay, type WorkoutPlan } from '@/domain/types';
import { endWorkoutLiveActivity, loadWorkoutFocus } from '@/live-activity/controller';
import { REST_GO_MS } from '@/motion';
import { requirePro } from '@/purchases/pro-gate';
import { useWorkoutStore, type PreviousExerciseLog } from '@/store/workout-store';

import {
  controlsFor,
  displaySummary,
  drumStep,
  drumView,
  finishSummary,
  formatKeysValue,
  keyStep,
  liftLamps,
  logFooter,
  setLabel,
  type Controls,
  type DrumView,
  type FinishSummary,
  type LiftLampState,
  type LogFooter,
} from './log-model';
import {
  addDraft,
  adjustRest,
  alternativesFor,
  beginEdit,
  canUndo,
  cancelEdit,
  commitEdit,
  completeSet,
  endRest,
  endWorkout,
  focusExercise,
  initialLogState,
  leaveFinish,
  logModeOf,
  patchStage,
  planExercisesFrom,
  relogSet,
  removeDraft,
  removeLoggedSet,
  reorderDrafts,
  restoreDraft,
  restPhase,
  selectExercise,
  stageOf,
  swapInDrafts,
  swappedPrescription,
  updateSet,
  type CompleteResult,
  type LogState,
  type RemovedLift,
  type SetValues,
  type Stage,
  type UndoneSet,
} from './log-state';
import { useLiveActivitySync } from './use-live-activity-sync';

/** Set changes settle before they are written; set logs land within this too. */
const SESSION_WRITE_DEBOUNCE_MS = 400;

export type LogLink = { planId: string; dayId: string; exerciseId?: string; start?: boolean };

export type OpenDay = {
  planId: string;
  dayId: string;
  /** ISO. Workout start; duration is measured from here. */
  startedAt: string;
  /** ISO. Last time a set changed. */
  updatedAt: string;
  /** The log continues a saved session (launch restore, or the same day reopened). */
  restored: boolean;
  /** A fresh Start (not a resume, a Live Activity or a conflict): the view may play its start moment. */
  startMoment: boolean;
};

/** `opened` a fresh log, `resumed` the open one, `conflict` asked first, `missing` no such day or no lifts. */
export type OpenResult = 'opened' | 'resumed' | 'conflict' | 'missing';

type Session = { open: OpenDay; log: LogState };

export type LogSessionValue = {
  // --- State --------------------------------------------------------------
  openDay: OpenDay | null;
  plan: WorkoutPlan | null;
  day: WorkoutDay | null;
  /** `log` / `rest` / `finish` while a day is open, else null (feed `deviceMode(state, mode)`). */
  mode: LogMode | null;
  drafts: DraftExercise[];
  exerciseIndex: number;
  current: DraftExercise | null;
  /** The set on the display: `set` (next to log), `extra` (a finished lift), `edit` (D21). */
  stage: Stage | null;
  /** What the wheel and keys control for the current lift (§6.6). */
  controls: Controls | null;
  /** The current lift's load step (`loadIncrement`). */
  increment: number;
  drum: DrumView | null;
  /** The keys' value beside the drum (`×8`, `0:45`), or null. */
  keysText: string | null;
  /** `SET 2/3`, `EXTRA SET`, `EDIT SET 2`. */
  setLabel: string | null;
  footer: LogFooter | null;
  /** One per lift for the rocker strip (`lampLayout`/`lampText` for many lifts). */
  lamps: LiftLampState[];
  previous: PreviousExerciseLog | null;
  /** The current lift's targets (computed for free users too; shown only with `showTargets`). */
  targets: (SetTarget | null)[] | null;
  showTargets: boolean;
  /** The first Log tap on an empty weight pointed at the drum: flash it; the next tap logs without weight. */
  needsWeight: boolean;
  rest: RestWindow | null;
  /** Rest hit 0:00: show GO for `REST_GO_MS`, then the log view returns on its own (D6). */
  restGo: boolean;
  canUndo: boolean;
  loggedSetCount: number;
  unloggedSetCount: number;
  finishSummary: FinishSummary | null;
  /** The display's VoiceOver label in log mode. */
  summary: string | null;
  units: 'kg' | 'lbs';

  // --- Actions ------------------------------------------------------------
  /** Start, resume or switch to a day (asks first when another day has logged sets). */
  open: (link: LogLink) => OpenResult;
  /** The big key in log mode (Save while editing). */
  completeSet: () => CompleteResult;
  /** One wheel notch on the drum; false when nothing moved (at a limit). */
  stepDrum: (direction: 1 | -1) => boolean;
  /** One press on the left keys (`+` is 1); false when nothing moved. */
  stepKeys: (direction: 1 | -1) => boolean;
  /** Typed values (the keypad sheet, D19). */
  setStageValues: (patch: Partial<SetValues>) => void;
  /** The current lift's set at `setIndex` (as the old `updateSet`). */
  updateSet: (setIndex: number, patch: Partial<LoggedSet>) => void;
  goToExercise: (index: number) => void;
  /** ‹ / ›: one lift from the latest index, so quick presses before a render each move one. */
  stepExercise: (delta: 1 | -1) => void;
  /** Undo last set: acts at once and returns what the toast's Undo needs (`relog`). */
  undoLastSet: () => UndoneSet | null;
  relog: (undone: UndoneSet) => void;
  beginEdit: (exerciseId: string, setId: string) => void;
  commitEdit: () => void;
  cancelEdit: () => void;
  /** Seconds to add (negative shortens); at or below 0 rest ends. */
  adjustRest: (seconds: number) => void;
  skipRest: () => void;
  alternativesFor: (exerciseId: string) => ExercisePrescription[];
  /** Swap a lift (keeps logged sets, writes the plan, no dialog). */
  swapExercise: (targetId: string, next: ExercisePrescription) => void;
  /** Appends a lift to the day in the plan and to today's session. Returns its index. */
  addLift: (exercise: ExercisePrescription) => number;
  /** Takes a lift out of today's session only; pass the result to `restoreLift` for Undo. */
  removeLiftFromSession: (exerciseId: string) => RemovedLift | null;
  restoreLift: (removed: RemovedLift) => void;
  /** Drag in Today: reorders the session and writes the plan (`persistOrder`). */
  reorder: (from: number, to: number) => void;
  /** The menu's End workout: finish mode. */
  endWorkout: () => void;
  /** Finish mode's Back. */
  leaveFinish: () => void;
  /** `TARGET ›`: the paywall (`targets`); true once targets show. */
  unlockTargets: () => Promise<boolean>;
  /** Saves the workout and closes the log. The new workout's id, or null when nothing was logged. */
  finish: () => string | null;
  /** Asks first ("Discard workout?"), then closes the log without saving. Resolves true when discarded. */
  discard: () => Promise<boolean>;
};

const LogSessionContext = createContext<LogSessionValue | null>(null);

function toLogSession(session: Session): LogSession {
  return {
    planId: session.open.planId,
    dayId: session.open.dayId,
    startedAt: session.open.startedAt,
    updatedAt: session.open.updatedAt,
    exerciseIndex: session.log.exerciseIndex,
    drafts: session.log.drafts,
    rest: session.log.rest,
  };
}

function sameDay(left: { planId: string; dayId: string } | null | undefined, right: { planId: string; dayId: string }) {
  return left != null && left.planId === right.planId && left.dayId === right.dayId;
}

/**
 * The open workout for the whole device (PLAN §4.2): one instance under `DeviceProvider`, read
 * with `useLogSession()` by the display, keys and the Today and exercise sheets. It restores the
 * saved session on launch, opens `logIntent`s from the device, persists like the old log
 * (debounced, only once a set is logged or the session was restored, flushed on background)
 * and keeps the Live Activity in sync.
 */
export function LogSessionProvider({ children }: { children: ReactNode }) {
  const store = useWorkoutStore();
  const {
    plans,
    units,
    isPro,
    workoutHistory,
    previousSetsForExercise,
    previousLogForExercise,
    logSession,
    saveLogSession,
  } = store;
  const device = useDevice();
  const haptics = useHaptics();

  // The store has hydrated before the device mounts: a saved session reopens the log.
  const [initial] = useState<{ session: Session | null }>(() => {
    const found = logSession ? findSessionDay(logSession, plans) : null;
    if (!logSession || !found) {
      return { session: null };
    }
    const opened = openLogSession({
      planId: found.plan.id,
      day: found.day,
      session: logSession,
      previousSetsForExercise,
    });
    return { session: sessionFromOpened({ planId: found.plan.id, dayId: found.day.id }, opened, false) };
  });
  const [session, setSession] = useState<Session | null>(initial.session);
  const sessionRef = useRef<Session | null>(initial.session);
  const storeRef = useRef(store);
  const ownsSession = useRef(initial.session?.open.restored ?? false);
  // Pro targets: computed for free users too; the quiet `TARGET ›` appears only where one exists.
  const [targetsUnlocked, setTargetsUnlocked] = useState(false);
  const [targetOfferDismissed, setTargetOfferDismissed] = useState(false);
  const showTargets = isPro || targetsUnlocked;
  const showTargetsRef = useRef(showTargets);
  /** The rest window (by `endsAtMs`) whose GO is showing. */
  const [goFor, setGoFor] = useState<number | null>(null);

  useEffect(() => {
    storeRef.current = store;
    showTargetsRef.current = showTargets;
  });

  const commit = useCallback((next: Session | null) => {
    const previous = sessionRef.current;
    let value = next;
    if (previous && next && previous.open === next.open && previous.log.drafts !== next.log.drafts) {
      value = { ...next, open: { ...next.open, updatedAt: new Date().toISOString() } };
    }
    sessionRef.current = value;
    setSession(value);
  }, []);

  const update = useCallback(
    (change: (log: LogState) => LogState) => {
      const current = sessionRef.current;
      if (!current) {
        return;
      }
      const log = change(current.log);
      if (log !== current.log) {
        commit({ open: current.open, log });
      }
    },
    [commit],
  );

  const targetsFor = useCallback((exercise: DraftExercise): (SetTarget | null)[] | null => {
    const { workoutHistory: history, units: unit } = storeRef.current;
    return targetsFromHistory(exercise.prescription, history, unit, exercise.sets.length);
  }, []);

  /** Live Activity focus: stored focus tracks the card; a link's exerciseId is the fallback. */
  const applyFocus = useCallback(
    (link: { planId: string; dayId: string }, fallbackId?: string) => {
      void loadWorkoutFocus(link.planId, link.dayId).then((stored) => {
        const target = stored ?? fallbackId;
        const current = sessionRef.current;
        if (target && current && sameDay(current.open, link)) {
          update((log) => focusExercise(log, target));
        }
      });
    },
    [update],
  );

  const open = useCallback(
    (link: LogLink): OpenResult => {
      const { plans: allPlans, logSession: saved, previousSetsForExercise: previousSets, isPro: pro, clearLogSession } =
        storeRef.current;
      const found = findSessionDay(link, allPlans);
      if (!found || found.day.exercises.length === 0) {
        return 'missing';
      }
      const current = sessionRef.current;
      if (sameDay(current?.open, link)) {
        applyFocus(link, link.exerciseId);
        return 'resumed';
      }

      const start = (to: LogLink, day: WorkoutDay, startMoment: boolean, from: LogSession | null) => {
        const opened = openLogSession({ planId: to.planId, day, session: from, previousSetsForExercise: previousSets });
        const next = sessionFromOpened(to, opened, startMoment && !opened.restored);
        // A fresh Pro log opens with targets in the drum; a restored one keeps what it had.
        const log =
          pro && !opened.restored
            ? { ...next.log, drafts: prefillTargets(next.log.drafts, targetsFor, previousSets) }
            : next.log;
        ownsSession.current = opened.restored;
        setTargetOfferDismissed(false);
        commit({ open: next.open, log });
        applyFocus(to, to.exerciseId);
      };

      // Another day with logged work (open here, or saved): ask before this one replaces it.
      const other: LogSession | null = current ? toLogSession(current) : saved && !sameDay(saved, link) ? saved : null;
      if (other && !sameDay(other, link) && loggedSetCount(other.drafts) > 0) {
        const otherTitle = findSessionDay(other, allPlans)?.day.title ?? 'Your other workout';
        const title = found.day.title;
        confirmAction(
          {
            title: `${otherTitle} is still open`,
            message: `${formatSetsCount(loggedSetCount(other.drafts))} logged there. Starting ${title} discards them.`,
            confirmLabel: `Discard and start ${title}`,
            cancelLabel: `Resume ${otherTitle}`,
            destructive: true,
          },
          () => {
            clearLogSession();
            start(link, found.day, false, null);
          },
          () => {
            // Resume the other day (it is still open here, or reopens from the saved session).
            const otherDay = findSessionDay(other, storeRef.current.plans)?.day;
            if (!sessionRef.current && otherDay) {
              start({ planId: other.planId, dayId: other.dayId }, otherDay, false, other);
            }
          },
        );
        return 'conflict';
      }
      start(link, found.day, link.start === true, saved);
      return 'opened';
    },
    [applyFocus, commit, targetsFor],
  );

  // Start, a Live Activity tap or a deep link: the device's `logIntent`.
  const { state: deviceState, consumeLogIntent } = device;
  const intent = deviceState.logIntent;
  useEffect(() => {
    if (!intent) {
      return;
    }
    consumeLogIntent(intent);
    open(intent);
  }, [consumeLogIntent, intent, open]);

  // A restored session: focus the lift the Live Activity shows.
  useEffect(() => {
    const restored = initial.session;
    if (restored) {
      applyFocus(restored.open);
    }
  }, [applyFocus, initial.session]);

  // --- Persistence (as the old log: debounced, once a set is logged or restored) --------
  useEffect(() => {
    if (!session) {
      return;
    }
    if (!ownsSession.current && loggedSetCount(session.log.drafts) === 0) {
      return;
    }
    const timer = setTimeout(() => {
      const latest = sessionRef.current;
      if (!latest || !sameDay(latest.open, session.open)) {
        return;
      }
      ownsSession.current = true;
      saveLogSession(toLogSession(latest));
    }, SESSION_WRITE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [saveLogSession, session]);

  // Backgrounding is the last reliable moment before iOS may kill the app. Coming back,
  // re-apply the Live Activity's focus (a Lock Screen tap often just foregrounds the app).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const latest = sessionRef.current;
      if (!latest) {
        return;
      }
      if (state === 'active') {
        void loadWorkoutFocus(latest.open.planId, latest.open.dayId).then((stored) => {
          const now = sessionRef.current;
          if (stored && now && sameDay(now.open, latest.open)) {
            update((log) => focusExercise(log, stored));
          }
        });
        return;
      }
      if (!ownsSession.current && loggedSetCount(latest.log.drafts) === 0) {
        return;
      }
      ownsSession.current = true;
      storeRef.current.saveLogSession(toLogSession(latest), { flush: true });
    });
    return () => subscription.remove();
  }, [update]);

  // --- Rest reaching 0:00 (D6): GO with the rest haptic for REST_GO_MS, then the log view. ---
  const rest = session?.log.rest ?? null;
  const restEndsAt = rest?.endsAtMs ?? null;
  useEffect(() => {
    if (restEndsAt == null) {
      return;
    }
    let expireTimer: ReturnType<typeof setTimeout> | null = null;
    const expire = () => update((log) => (log.rest?.endsAtMs === restEndsAt ? endRest(log) : log));
    const reachZero = () => {
      const window = sessionRef.current?.log.rest ?? null;
      if (window?.endsAtMs !== restEndsAt) {
        return;
      }
      // Late (the app was in the background past GO): end quietly, no stale GO.
      if (restPhase(window, Date.now(), REST_GO_MS) !== 'go') {
        expire();
        return;
      }
      haptics.restGo();
      setGoFor(restEndsAt);
      update((log) => (log.rest?.endsAtMs === restEndsAt ? { ...log, restOver: true } : log));
      expireTimer = setTimeout(expire, Math.max(0, restEndsAt + REST_GO_MS - Date.now()));
    };
    const zeroTimer = setTimeout(reachZero, Math.max(0, restEndsAt - Date.now()));
    return () => {
      clearTimeout(zeroTimer);
      if (expireTimer) {
        clearTimeout(expireTimer);
      }
    };
  }, [haptics, restEndsAt, update]);

  // --- Live Activity --------------------------------------------------------
  useLiveActivitySync({
    planId: session?.open.planId ?? null,
    dayId: session?.open.dayId ?? null,
    drafts: session?.log.drafts ?? EMPTY_DRAFTS,
    exerciseIndex: session?.log.exerciseIndex ?? 0,
    rest,
    restOver: session?.log.restOver ?? false,
  });

  // --- Actions ----------------------------------------------------------------
  const actions = useMemo(() => {
    const planAndDay = () => {
      const current = sessionRef.current;
      return current ? findSessionDay(current.open, storeRef.current.plans) : null;
    };
    const writeDay = (change: (day: WorkoutDay) => WorkoutDay) => {
      const found = planAndDay();
      if (found) {
        storeRef.current.updatePlan(withDay(found.plan, found.day.id, change));
      }
    };
    const close = () => {
      sessionRef.current = null;
      setSession(null);
      setGoFor(null);
    };
    const increment = (prescription: ExercisePrescription) => loadIncrement(prescription, storeRef.current.units);
    const step = (pick: (stage: Stage) => Partial<SetValues>) => {
      const current = sessionRef.current;
      const stage = current ? stageOf(current.log) : null;
      if (!stage) {
        return false;
      }
      const patch = pick(stage);
      if (Object.keys(patch).length === 0) {
        return false;
      }
      update((log) => patchStage(log, patch));
      return true;
    };

    return {
      completeSet: (): CompleteResult => {
        const current = sessionRef.current;
        if (!current) {
          return { kind: 'none' };
        }
        const { state, result } = completeSet(current.log, {
          nowMs: Date.now(),
          restSeconds: restSecondsForExercise,
          targets: showTargetsRef.current ? targetsFor : null,
        });
        if (state !== current.log) {
          commit({ open: current.open, log: state });
        }
        if (result.kind === 'logged') {
          track('set_logged', { set_number: result.setNumber });
        }
        return result;
      },
      stepDrum: (direction: 1 | -1) =>
        step((stage) =>
          drumStep(controlsFor(stage.current.prescription).drum, stage.values, direction, increment(stage.current.prescription)),
        ),
      stepKeys: (direction: 1 | -1) =>
        step((stage) => keyStep(controlsFor(stage.current.prescription).keys, stage.values, direction)),
      setStageValues: (patch: Partial<SetValues>) => update((log) => patchStage(log, patch)),
      updateSet: (setIndex: number, patch: Partial<LoggedSet>) => update((log) => updateSet(log, setIndex, patch)),
      goToExercise: (index: number) => update((log) => (index === log.exerciseIndex && !log.finishing ? log : selectExercise(log, index))),
      stepExercise: (delta: 1 | -1) =>
        update((log) => {
          const index = log.exerciseIndex + delta;
          return index < 0 || index >= log.drafts.length ? log : selectExercise(log, index);
        }),
      undoLastSet: (): UndoneSet | null => {
        const current = sessionRef.current;
        if (!current) {
          return null;
        }
        const { state, undone } = removeLoggedSet(current.log);
        if (undone) {
          setGoFor(null);
          commit({ open: current.open, log: state });
        }
        return undone;
      },
      relog: (undone: UndoneSet) => update((log) => relogSet(log, undone, Date.now())),
      beginEdit: (exerciseId: string, setId: string) => update((log) => beginEdit(log, exerciseId, setId)),
      commitEdit: () => update(commitEdit),
      cancelEdit: () => update(cancelEdit),
      adjustRest: (seconds: number) => update((log) => adjustRest(log, seconds, Date.now())),
      skipRest: () => update(endRest),
      alternativesFor: (exerciseId: string) => {
        const exercise = sessionRef.current?.log.drafts.find((item) => item.prescription.id === exerciseId);
        return exercise
          ? alternativesFor(exercise.prescription, offlineCatalogExercises(storeRef.current.customExercises))
          : [];
      },
      swapExercise: (targetId: string, next: ExercisePrescription) => {
        const current = sessionRef.current;
        const target = current?.log.drafts.find((item) => item.prescription.id === targetId);
        if (!current || !target || !planAndDay()) {
          return;
        }
        const swapped = swappedPrescription(target.prescription, next);
        const log = swapInDrafts(current.log, targetId, swapped, {
          previousSetsForExercise: storeRef.current.previousSetsForExercise,
          targetsFor: showTargetsRef.current ? targetsFor : null,
        });
        if (!log) {
          return;
        }
        commit({ open: current.open, log });
        writeDay((day) => ({
          ...day,
          exercises: day.exercises.map((item) => (item.id === targetId ? swapped : item)),
        }));
      },
      addLift: (exercise: ExercisePrescription) => {
        const current = sessionRef.current;
        if (!current || !planAndDay()) {
          return -1;
        }
        const prescription = clonePrescription(exercise);
        const previousSets = storeRef.current.previousSetsForExercise;
        let drafts = buildDrafts([prescription], previousSets);
        if (showTargetsRef.current) {
          drafts = prefillTargets(drafts, targetsFor, previousSets);
        }
        const draft = drafts[0];
        if (!draft) {
          return -1;
        }
        const { state, index } = addDraft(current.log, draft);
        commit({ open: current.open, log: state });
        writeDay((day) => ({ ...day, exercises: [...day.exercises, prescription] }));
        return index;
      },
      removeLiftFromSession: (exerciseId: string) => {
        const current = sessionRef.current;
        if (!current) {
          return null;
        }
        const { state, removed } = removeDraft(current.log, exerciseId);
        if (removed) {
          commit({ open: current.open, log: state });
        }
        return removed;
      },
      restoreLift: (removed: RemovedLift) => update((log) => restoreDraft(log, removed)),
      reorder: (from: number, to: number) => {
        const current = sessionRef.current;
        if (!current || !planAndDay()) {
          return;
        }
        const log = reorderDrafts(current.log, from, to);
        commit({ open: current.open, log });
        writeDay((day) => ({ ...day, exercises: planExercisesFrom(log.drafts) }));
      },
      endWorkout: () => update(endWorkout),
      leaveFinish: () => update(leaveFinish),
      unlockTargets: async () => {
        const unlocked = await requirePro('targets');
        if (!unlocked) {
          setTargetOfferDismissed(true);
          return false;
        }
        setTargetsUnlocked(true);
        const previousSets = storeRef.current.previousSetsForExercise;
        update((log) => ({ ...log, drafts: prefillTargets(log.drafts, targetsFor, previousSets) }));
        return true;
      },
      finish: (): string | null => {
        const current = sessionRef.current;
        const found = planAndDay();
        if (!current || !found) {
          return null;
        }
        const exercises: LoggedExercise[] = current.log.drafts
          .map((exercise) => ({
            id: newId(),
            exerciseName: exercise.prescription.name,
            sets: exercise.sets
              .filter((set) => set.done)
              .map(({ done: _done, extra: _extra, ...set }) => set),
            // History never stores media URLs; media resolves from catalog identity.
            thumbnailURL: null,
            imageURL: null,
            imageURLs: {},
          }))
          .filter((exercise) => exercise.sets.length > 0);
        if (exercises.length === 0) {
          return null;
        }
        const { completeWorkout, clearLogSession, workoutHistory: history } = storeRef.current;
        const workout = completeWorkout({
          title: found.day.title,
          exercises,
          durationMinutes: sessionDurationMinutes(current.open.startedAt, current.open.updatedAt),
          startedAt: current.open.startedAt,
          planId: found.plan.id,
          dayId: found.day.id,
        });
        clearLogSession({ planId: found.plan.id, dayId: found.day.id });
        track('workout_completed', {
          exercises: workout.exercises.length,
          sets: workout.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0),
          duration_minutes: workout.durationMinutes,
          prs: workoutPersonalBests(workout, history).count,
        });
        void endWorkoutLiveActivity();
        close();
        return workout.id;
      },
      discard: () =>
        new Promise<boolean>((resolve) => {
          const current = sessionRef.current;
          if (!current) {
            resolve(false);
            return;
          }
          const logged = loggedSetCount(current.log.drafts);
          confirmAction(
            {
              title: 'Discard workout?',
              message: logged > 0 ? `${formatSetsCount(logged)} logged will not be saved.` : undefined,
              confirmLabel: 'Discard',
              cancelLabel: 'Keep logging',
              destructive: true,
            },
            () => {
              const latest = sessionRef.current;
              if (latest) {
                storeRef.current.clearLogSession({ planId: latest.open.planId, dayId: latest.open.dayId });
              }
              void endWorkoutLiveActivity();
              close();
              resolve(true);
            },
            () => resolve(false),
          );
        }),
    };
  }, [commit, targetsFor, update]);

  // --- Derived state ----------------------------------------------------------
  const found = session ? findSessionDay(session.open, plans) : null;
  const log = session?.log ?? null;
  const stage = log ? stageOf(log) : null;
  const current = stage?.current ?? null;
  const controls = current ? controlsFor(current.prescription) : null;
  const increment = current ? loadIncrement(current.prescription, units) : 0;
  const previous = current ? previousLogForExercise(current.prescription.name) : null;
  const targets = useMemo(
    () => (current ? targetsFromHistory(current.prescription, workoutHistory, units, current.sets.length) : null),
    [current, units, workoutHistory],
  );
  const stageTarget = stage && targets ? (targets[stage.setIndex] ?? null) : null;
  const minutes = current ? durationIsMinutes(current.prescription) : false;
  const offerTargets = !showTargets && !targetOfferDismissed && rest == null && stage?.kind === 'set';
  const needsWeight =
    stage?.kind === 'set' &&
    log?.weightNudgeSetId === stage.set?.id &&
    stage.values.weight == null &&
    stage.values.counterweight == null;
  const restGo = rest != null && goFor === rest.endsAtMs;

  const value = useMemo<LogSessionValue>(
    () => ({
      openDay: session?.open ?? null,
      plan: found?.plan ?? null,
      day: found?.day ?? null,
      mode: log ? logModeOf(log) : null,
      drafts: log?.drafts ?? EMPTY_DRAFTS,
      exerciseIndex: log?.exerciseIndex ?? 0,
      current,
      stage,
      controls,
      increment,
      drum: stage && controls ? drumView(controls.drum, stage.values, increment, units) : null,
      keysText: stage && controls ? formatKeysValue(controls.keys, stage.values) : null,
      setLabel: stage ? setLabel(stage) : null,
      footer: stage
        ? logFooter({
            previousSets: previous?.sets,
            setIndex: stage.setIndex,
            target: stageTarget,
            showTargets,
            offerTargets,
            minutes,
          })
        : null,
      lamps: log ? liftLamps(log.drafts, log.exerciseIndex) : [],
      previous,
      targets,
      showTargets,
      needsWeight,
      rest,
      restGo,
      canUndo: log ? canUndo(log) : false,
      loggedSetCount: log ? loggedSetCount(log.drafts) : 0,
      unloggedSetCount: log ? unloggedSetCount(log.drafts) : 0,
      finishSummary: log ? finishSummary(log.drafts, units) : null,
      summary:
        stage && controls && current
          ? displaySummary({
              name: current.prescription.name,
              stage,
              controls,
              units,
              previousSets: previous?.sets,
              target: showTargets ? stageTarget : null,
              minutes,
            })
          : null,
      units,
      open,
      ...actions,
    }),
    [
      actions,
      controls,
      current,
      found,
      increment,
      log,
      minutes,
      needsWeight,
      offerTargets,
      open,
      previous,
      rest,
      restGo,
      session,
      showTargets,
      stage,
      stageTarget,
      targets,
      units,
    ],
  );

  return <LogSessionContext.Provider value={value}>{children}</LogSessionContext.Provider>;
}

const EMPTY_DRAFTS: DraftExercise[] = [];

function sessionFromOpened(
  link: { planId: string; dayId: string },
  opened: OpenedLog,
  startMoment: boolean,
): Session {
  return {
    open: {
      planId: link.planId,
      dayId: link.dayId,
      startedAt: opened.startedAt,
      updatedAt: opened.updatedAt,
      restored: opened.restored,
      startMoment,
    },
    log: initialLogState(opened),
  };
}

/** The open workout. Must be under `LogSessionProvider`. */
export function useLogSession(): LogSessionValue {
  const value = useContext(LogSessionContext);
  if (!value) {
    throw new Error('useLogSession must be used within a LogSessionProvider');
  }
  return value;
}
