import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  AppState,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type AccessibilityActionEvent,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  ScrollView as GestureScrollView,
} from 'react-native-gesture-handler';
import { KeyboardStickyView, useKeyboardState } from '@/keyboard';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedSheet } from '@/components/animated-sheet';
import { Button } from '@/components/button';
import { confirmAction } from '@/components/confirm-action';
import { LogRest } from '@/components/log-rest';
import { PaperRow } from '@/components/paper';
import { ResidueSetRow } from '@/components/residue-set-row';
import { TargetLine } from '@/components/target-line';
import { exerciseStillMediaURL, offlineCatalogExercises } from '@/catalog';
import { radius } from '@/constants/theme';
import {
  clonePrescription,
  durationIsMinutes,
  emptyLoggedSet,
  formatHistoryWhenInMonth,
  formatLoggedSetLine,
  formatPlanMetric,
  formatSetsCount,
  parsePositiveNumber,
  usesDuration,
  usesReps,
  usesWeight,
  withDay,
} from '@/domain/helpers';
import {
  bestSetForExercise,
  buildDrafts,
  carryForward,
  exerciseIsComplete,
  findSessionDay,
  formatSetsCompact,
  formatShortDate,
  loggedSetCount,
  nextIncompleteIndex,
  openLogSession,
  prefillTargets,
  sessionDurationMinutes,
  unloggedSetCount,
  type BestSet,
  type DraftExercise,
  type DraftSet,
  type LogSession,
  type RestWindow,
} from '@/domain/log-session';
import { restSecondsForExercise } from '@/domain/rest';
import { spokenTargets, targetsFromHistory, type SetTarget } from '@/domain/targets';
import { EASE_OUT } from '@/motion';
import {
  newId,
  type ExercisePrescription,
  type LoggedExercise,
  type LoggedSet,
} from '@/domain/types';
import { endWorkoutLiveActivity, loadWorkoutFocus, syncWorkoutLiveActivity } from '@/live-activity/controller';
import { parseWorkoutLogUrl, workoutLogHref } from '@/live-activity/url';
import { upcomingExerciseIndex } from '@/live-activity/upcoming';
import { requirePro } from '@/purchases/pro-gate';
import { useWorkoutStore, type PreviousExerciseLog } from '@/store/workout-store';
import { useTheme } from '@/theme/theme-context';

type WellFocus = 'weight' | 'reps' | 'duration' | null;

type SetValues = Pick<LoggedSet, 'weight' | 'reps' | 'counterweight' | 'durationSeconds'>;

/** A logged set loaded into the wells. Applied only on Update set. */
type SetEdit = {
  exerciseId: string;
  setId: string;
  values: SetValues;
};

const WEIGHT_STEP = { kg: 2.5, lbs: 5 } as const;
const SWIPE_DISTANCE = 56;
const CHIP_PAD_X = 12;
const REST_IN = FadeIn.duration(160).easing(EASE_OUT);
const REST_OUT = FadeOut.duration(120).easing(EASE_OUT);
/** Typing in a well settles before it is written; set logs land within this too. */
const SESSION_WRITE_DEBOUNCE_MS = 400;
/** Display text (34pt name) and well numerals stop growing here (Dynamic Type). */
const DISPLAY_TEXT_MAX_SCALE = 1.2;
const WELL_TEXT_MAX_SCALE = 1.3;

function project(velocity: number, decelerationRate = 0.998) {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function nudgeString(value: string, delta: number): string {
  const current = parsePositiveNumber(value);
  if (current == null && delta < 0) {
    return value;
  }
  const next = Math.max(0, Number(((current ?? 0) + delta).toFixed(4)));
  if (Number.isInteger(next)) {
    return String(next);
  }
  return String(Number(next.toFixed(2)));
}

function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item == null) {
    return items;
  }
  const clamped = Math.max(0, Math.min(next.length, to));
  next.splice(clamped, 0, item);
  return next;
}

function alternativesFor(
  exercise: ExercisePrescription,
  pool: ExercisePrescription[],
): ExercisePrescription[] {
  const muscle = exercise.targetMuscles[0]?.toLowerCase();
  const name = exercise.name.toLowerCase();
  const matches = pool.filter((item) => {
    if (item.name.toLowerCase() === name) {
      return false;
    }
    if (!muscle) {
      return item.equipments[0] === exercise.equipments[0];
    }
    return (
      item.targetMuscles.some((entry) => entry.toLowerCase() === muscle) ||
      item.bodyParts.some((entry) => entry.toLowerCase() === muscle)
    );
  });
  const unique: ExercisePrescription[] = [];
  for (const item of matches) {
    if (unique.some((entry) => entry.name.toLowerCase() === item.name.toLowerCase())) {
      continue;
    }
    unique.push(item);
    if (unique.length === 3) {
      break;
    }
  }
  return unique;
}

function sessionFrom(
  link: { planId: string; dayId: string },
  startedAt: string,
  updatedAt: string,
  state: { drafts: DraftExercise[]; exerciseIndex: number; rest: RestWindow | null },
): LogSession {
  return {
    planId: link.planId,
    dayId: link.dayId,
    startedAt,
    updatedAt,
    exerciseIndex: state.exerciseIndex,
    drafts: state.drafts,
    rest: state.rest,
  };
}

function setValues(set: LoggedSet): SetValues {
  return {
    weight: set.weight ?? null,
    reps: set.reps ?? null,
    counterweight: set.counterweight ?? null,
    durationSeconds: set.durationSeconds ?? null,
  };
}

function hapticSuccess() {
  if (process.env.EXPO_OS === 'ios') {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
}

export function LogWorkoutScreen() {
  const { colors, type } = useTheme();
  const params = useLocalSearchParams<{ planId?: string; dayId?: string; exerciseId?: string }>();
  const planId = firstParam(params.planId);
  const dayId = firstParam(params.dayId);
  const exerciseIdParam = firstParam(params.exerciseId);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const {
    plans,
    units,
    isPro,
    customExercises,
    workoutHistory,
    previousSetsForExercise,
    previousLogForExercise,
    completeWorkout,
    updatePlan,
    logSession,
    saveLogSession,
    clearLogSession,
  } = useWorkoutStore();
  const plan = plans.find((item) => item.id === planId);
  const day = plan?.days.find((item) => item.id === dayId);

  // The root stack mounts only after the store hydrates, so history and any saved
  // session are already here: restore this plan/day's session, else start fresh.
  const [opened] = useState(() =>
    openLogSession({ planId, day, session: logSession, previousSetsForExercise }),
  );
  // Another day's session with logged work: ask before this log replaces it.
  const [conflict] = useState<LogSession | null>(() =>
    !opened.restored && day && logSession && loggedSetCount(logSession.drafts) > 0 ? logSession : null,
  );
  const startedAt = opened.startedAt;
  const [rest, setRest] = useState<RestWindow | null>(opened.rest);
  const [exerciseIndex, setExerciseIndex] = useState(opened.exerciseIndex);
  // Pro targets (next-session targets). Computed for free users too: the quiet
  // `Target ›` offer only appears where a target would exist.
  const [targetsUnlocked, setTargetsUnlocked] = useState(false);
  const [targetOfferDismissed, setTargetOfferDismissed] = useState(false);
  const showTargets = isPro || targetsUnlocked;
  const targetsFor = useCallback(
    (exercise: DraftExercise): (SetTarget | null)[] | null =>
      targetsFromHistory(exercise.prescription, workoutHistory, units, exercise.sets.length),
    [units, workoutHistory],
  );
  // A fresh Pro log opens with targets in the wells; a restored one keeps what it had.
  const [drafts, setDrafts] = useState<DraftExercise[]>(() =>
    isPro && !opened.restored
      ? prefillTargets(opened.drafts, targetsFor, previousSetsForExercise)
      : opened.drafts,
  );
  const draftsRef = useRef(drafts);
  const [wellFocus, setWellFocus] = useState<WellFocus>(null);
  const [editing, setEditing] = useState<SetEdit | null>(null);
  const [weightNudgeSetId, setWeightNudgeSetId] = useState<string | null>(null);
  const [loggedPulseId, setLoggedPulseId] = useState<string | null>(null);
  const [residueResetKeys, setResidueResetKeys] = useState<Record<string, number>>({});
  const [sheet, setSheet] = useState<'day' | 'exercise' | null>(null);
  const weightInputRef = useRef<TextInput>(null);
  const keyboardOpen = useKeyboardState((state) => state.isVisible);
  const focusedWell: WellFocus = keyboardOpen ? wellFocus : null;
  const openSheet = (next: 'day' | 'exercise') => {
    Keyboard.dismiss();
    setSheet(next);
  };
  /** Every exercise change drops a pending edit / weight nudge; they belong to one set. */
  const goToExercise = (next: number | ((index: number) => number)) => {
    setEditing(null);
    setWeightNudgeSetId(null);
    setExerciseIndex(next);
  };

  // --- Session persistence -------------------------------------------------
  // The session is written through the store (debounced) once the first set is
  // logged, or from the start when this log restored one. Finish / discard close it.
  const ownsSession = useRef(opened.restored);
  const persistBlocked = useRef(conflict != null);
  const closed = useRef(false);
  const updatedAtRef = useRef(opened.updatedAt);
  const lastDraftsRef = useRef(drafts);
  const latest = useRef({ drafts, exerciseIndex, rest });
  const askedConflict = useRef(false);

  useEffect(() => {
    draftsRef.current = drafts;
    latest.current = { drafts, exerciseIndex, rest };
    if (drafts !== lastDraftsRef.current) {
      lastDraftsRef.current = drafts;
      updatedAtRef.current = new Date().toISOString();
    }
  }, [drafts, exerciseIndex, rest]);

  useEffect(() => {
    if (!planId || !dayId || closed.current || persistBlocked.current) {
      return;
    }
    if (!ownsSession.current && loggedSetCount(drafts) === 0) {
      return;
    }
    const timer = setTimeout(() => {
      if (closed.current || persistBlocked.current) {
        return;
      }
      ownsSession.current = true;
      saveLogSession(sessionFrom({ planId, dayId }, startedAt, updatedAtRef.current, latest.current));
    }, SESSION_WRITE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [dayId, drafts, exerciseIndex, planId, rest, saveLogSession, startedAt]);

  // Backgrounding is the last reliable moment before iOS may kill the app.
  useEffect(() => {
    if (!planId || !dayId) {
      return;
    }
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' || closed.current || persistBlocked.current) {
        return;
      }
      if (!ownsSession.current && loggedSetCount(latest.current.drafts) === 0) {
        return;
      }
      ownsSession.current = true;
      saveLogSession(
        sessionFrom({ planId, dayId }, startedAt, updatedAtRef.current, latest.current),
        { flush: true },
      );
    });
    return () => subscription.remove();
  }, [dayId, planId, saveLogSession, startedAt]);

  useEffect(() => {
    if (!conflict || !day || askedConflict.current) {
      return;
    }
    askedConflict.current = true;
    const other = findSessionDay(conflict, plans)?.day.title ?? 'Your other workout';
    confirmAction(
      {
        title: `${other} is still open`,
        message: `${formatSetsCount(loggedSetCount(conflict.drafts))} logged there. Starting ${day.title} discards them.`,
        confirmLabel: `Discard and start ${day.title}`,
        cancelLabel: `Resume ${other}`,
        destructive: true,
      },
      () => {
        persistBlocked.current = false;
        clearLogSession();
      },
      () => {
        closed.current = true;
        router.replace(workoutLogHref({ planId: conflict.planId, dayId: conflict.dayId }));
      },
    );
  }, [clearLogSession, conflict, day, plans, router]);

  const startRest = (seconds: number) => {
    const startedAtMs = Date.now();
    setRest({ startedAtMs, endsAtMs: startedAtMs + seconds * 1000 });
  };

  const adjustRest = (seconds: number) => {
    setRest((window) => {
      if (!window) {
        return window;
      }
      const endsAtMs = window.endsAtMs + seconds * 1000;
      return endsAtMs <= Date.now() ? null : { ...window, endsAtMs };
    });
  };

  const current = drafts[exerciseIndex];
  const previous = current ? previousLogForExercise(current.prescription.name) : null;
  const nextIndex = upcomingExerciseIndex(drafts, exerciseIndex);
  const nextExercise = drafts[nextIndex];
  const nextExerciseId = nextExercise?.prescription.id;
  const nextExerciseName = nextExercise?.prescription.name;
  const nextImageURL = nextExercise ? exerciseStillMediaURL(nextExercise.prescription) : null;
  const catalog = useMemo(() => offlineCatalogExercises(customExercises), [customExercises]);

  useEffect(() => {
    if (!planId || !dayId || !nextExerciseId || !nextExerciseName) {
      return;
    }
    void syncWorkoutLiveActivity({
      planId,
      dayId,
      exerciseId: nextExerciseId,
      exerciseName: nextExerciseName,
      imageURL: nextImageURL,
      rest,
    });
  }, [dayId, nextExerciseId, nextExerciseName, nextImageURL, planId, rest]);

  useEffect(() => {
    return () => {
      void endWorkoutLiveActivity();
    };
  }, []);

  const selectExerciseById = (exerciseId: string) => {
    const index = draftsRef.current.findIndex((item) => item.prescription.id === exerciseId);
    if (index >= 0) {
      setExerciseIndex(index);
    }
  };

  useEffect(() => {
    if (!planId || !dayId || drafts.length === 0) {
      return;
    }
    void loadWorkoutFocus(planId, dayId).then((stored) => {
      // Stored focus tracks the current Live Activity card; launch params go stale.
      const target = stored ?? exerciseIdParam;
      if (target) {
        selectExerciseById(target);
      }
    });
  }, [dayId, drafts.length, exerciseIdParam, planId]);

  // Live Activity / deep link while this modal is already open: jump to that exercise
  // without remounting, so logged sets in this session stay intact.
  useEffect(() => {
    if (!planId || !dayId) {
      return;
    }
    const applyUrl = (url: string) => {
      const parsed = parseWorkoutLogUrl(url);
      if (!parsed || parsed.planId !== planId || parsed.dayId !== dayId) {
        return;
      }
      void loadWorkoutFocus(planId, dayId).then((stored) => {
        const target = stored ?? parsed.exerciseId;
        if (target) {
          selectExerciseById(target);
        }
      });
    };
    // Only live taps, never getInitialURL(): the launch URL is already reflected in
    // this screen's params and re-reading it would fight the user's own selection.
    const subscription = Linking.addEventListener('url', ({ url }) => applyUrl(url));
    return () => subscription.remove();
  }, [dayId, planId]);

  // Lock Screen / Dynamic Island tap often just foregrounds the app. Re-apply the
  // focused exercise (kept in sync with the Live Activity card) when we become active.
  // Stored focus only — the launch param goes stale as the workout moves on.
  useEffect(() => {
    if (!planId || !dayId) {
      return;
    }
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        return;
      }
      void loadWorkoutFocus(planId, dayId).then((stored) => {
        if (stored) {
          selectExerciseById(stored);
        }
      });
    });
    return () => subscription.remove();
  }, [dayId, planId]);

  const exerciseComplete = exerciseIsComplete(current);
  const activeSetIndex = current ? current.sets.findIndex((set) => !set.done) : -1;
  const activeSet = current && activeSetIndex >= 0 ? current.sets[activeSetIndex] : undefined;
  const lastDoneSet = current ? [...current.sets].reverse().find((set) => set.done) : undefined;
  const editingSet =
    editing && current && editing.exerciseId === current.prescription.id
      ? current.sets.find((set) => set.id === editing.setId && set.done)
      : undefined;
  const edit = editingSet && editing ? editing : null;
  const wellValues: SetValues | undefined = edit ? edit.values : (activeSet ?? lastDoneSet);
  const showWeight = current ? usesWeight(current.prescription.trackingMode) : false;
  const showReps = current ? usesReps(current.prescription.trackingMode) : false;
  const showDuration = current ? usesDuration(current.prescription.trackingMode) && !showReps : false;
  const minutes = current ? durationIsMinutes(current.prescription) : false;
  const stageSetIndex = editingSet && current ? current.sets.indexOf(editingSet) : activeSetIndex;
  const setHint =
    current && stageSetIndex >= 0 ? `Set ${stageSetIndex + 1} of ${current.sets.length}` : undefined;
  const currentTargets = useMemo(() => (current ? targetsFor(current) : null), [current, targetsFor]);
  const stageTarget =
    currentTargets && stageSetIndex >= 0 ? (currentTargets[stageSetIndex] ?? null) : null;

  const updateSet = (setIndex: number, patch: Partial<LoggedSet>) => {
    setDrafts((items) =>
      items.map((exercise, index) => {
        if (index !== exerciseIndex) {
          return exercise;
        }
        return {
          ...exercise,
          sets: exercise.sets.map((set, inner) => (inner === setIndex ? { ...set, ...patch } : set)),
        };
      }),
    );
  };

  const beginEdit = (set: DraftSet, patch?: Partial<SetValues>) => {
    if (!current) {
      return;
    }
    setWeightNudgeSetId(null);
    setEditing({
      exerciseId: current.prescription.id,
      setId: set.id,
      values: { ...setValues(set), ...patch },
    });
  };

  const cancelEdit = () => {
    setEditing(null);
    setWellFocus(null);
    Keyboard.dismiss();
  };

  const commitEdit = () => {
    if (!edit) {
      return;
    }
    setDrafts((items) =>
      items.map((exercise) =>
        exercise.prescription.id !== edit.exerciseId
          ? exercise
          : {
              ...exercise,
              sets: exercise.sets.map((set) => (set.id === edit.setId ? { ...set, ...edit.values } : set)),
            },
      ),
    );
    cancelEdit();
  };

  /** Wells write to: the set being edited, else the active set, else (done) open the last set for edit. */
  const applyWellPatch = (patch: Partial<SetValues>) => {
    if (!current) {
      return;
    }
    if (edit) {
      setEditing({ ...edit, values: { ...edit.values, ...patch } });
      return;
    }
    if (activeSetIndex >= 0) {
      updateSet(activeSetIndex, patch);
      return;
    }
    if (lastDoneSet) {
      beginEdit(lastDoneSet, patch);
    }
  };

  const focusWell = (well: Exclude<WellFocus, null>) => {
    setWellFocus(well);
    if (!edit && activeSetIndex < 0 && lastDoneSet) {
      beginEdit(lastDoneSet);
    }
  };

  const completeSet = () => {
    if (!current || !activeSet) {
      return;
    }
    const setIndex = activeSetIndex;
    const target = activeSet;
    const noLoad = target.weight == null && target.counterweight == null;
    const loggedWeightlessBefore = current.sets.some(
      (set) => set.done && set.weight == null && set.counterweight == null,
    );
    // First tap on a weighted exercise with an empty weight: point at the well once.
    if (showWeight && noLoad && !loggedWeightlessBefore && weightNudgeSetId !== target.id) {
      setWeightNudgeSetId(target.id);
      setWellFocus('weight');
      weightInputRef.current?.focus();
      return;
    }

    // Later sets inherit this one; with targets, each keeps its own target (a chosen load carries).
    const nextDrafts = drafts.map((exercise, index) =>
      index !== exerciseIndex
        ? exercise
        : {
            ...exercise,
            sets: carryForward(exercise.sets, setIndex, target, showTargets ? currentTargets : null),
          },
    );
    setDrafts(nextDrafts);

    setLoggedPulseId(target.id);
    setWellFocus(null);
    setWeightNudgeSetId(null);
    Keyboard.dismiss();
    if (process.env.EXPO_OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    // No rest after the last set of the whole workout.
    if (unloggedSetCount(nextDrafts) > 0) {
      startRest(restSecondsForExercise(current.prescription));
    } else {
      setRest(null);
    }
    if (exerciseIsComplete(nextDrafts[exerciseIndex])) {
      const advanceTo = nextIncompleteIndex(nextDrafts, exerciseIndex, { wrap: false });
      if (advanceTo >= 0) {
        setTimeout(() => goToExercise(advanceTo), 220);
      }
    }
  };

  const addSet = () => {
    if (!current || !lastDoneSet) {
      return;
    }
    setEditing(null);
    setDrafts((items) =>
      items.map((exercise, index) =>
        index !== exerciseIndex
          ? exercise
          : {
              ...exercise,
              sets: [
                ...exercise.sets,
                { ...emptyLoggedSet(exercise.sets.length + 1, lastDoneSet), done: false, extra: true },
              ],
            },
      ),
    );
  };

  const removeExtraSet = (setId: string) => {
    setDrafts((items) =>
      items.map((exercise, index) =>
        index !== exerciseIndex
          ? exercise
          : { ...exercise, sets: exercise.sets.filter((set) => !(set.id === setId && set.extra && !set.done)) },
      ),
    );
    setWeightNudgeSetId(null);
    Keyboard.dismiss();
  };

  // A Live Activity tap can launch straight into /log with nothing beneath it,
  // so back() alone would leave the user stuck in the workout.
  const leaveWorkout = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/');
  };

  const discardWithoutSaving = () => {
    closed.current = true;
    if (planId && dayId) {
      clearLogSession({ planId, dayId });
    }
    void endWorkoutLiveActivity();
    leaveWorkout();
  };

  const confirmDiscard = () => {
    const logged = loggedSetCount(drafts);
    confirmAction(
      {
        title: 'Discard workout?',
        message: logged > 0 ? `${formatSetsCount(logged)} logged will not be saved.` : undefined,
        confirmLabel: 'Discard',
        cancelLabel: 'Keep logging',
        destructive: true,
      },
      discardWithoutSaving,
    );
  };

  const removeLoggedSet = (setId: string) => {
    setDrafts((items) =>
      items.map((exercise, index) => {
        if (index !== exerciseIndex) {
          return exercise;
        }
        return {
          ...exercise,
          sets: exercise.sets.map((set) => (set.id === setId && set.done ? { ...set, done: false } : set)),
        };
      }),
    );
    if (editing?.setId === setId) {
      setEditing(null);
    }
    setRest(null);
    setLoggedPulseId(null);
  };

  const confirmUndoSet = (set: DraftSet) => {
    const line = formatLoggedSetLine(set, { minutes });
    confirmAction(
      {
        title: 'Undo this set?',
        message: `${line} goes back to not logged.`,
        confirmLabel: 'Undo set',
        cancelLabel: 'Keep',
        destructive: true,
      },
      () => removeLoggedSet(set.id),
      () => {
        setResidueResetKeys((keys) => ({
          ...keys,
          [set.id]: (keys[set.id] ?? 0) + 1,
        }));
      },
    );
  };

  const finish = (confirmed = false) => {
    if (!day || !plan) {
      leaveWorkout();
      return;
    }
    const exercises: LoggedExercise[] = drafts
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
      confirmAction(
        {
          title: 'No sets logged',
          message: 'Log at least one set to save this workout.',
          confirmLabel: 'Discard',
          cancelLabel: 'Keep logging',
          destructive: true,
        },
        discardWithoutSaving,
      );
      return;
    }

    const remaining = unloggedSetCount(drafts);
    if (remaining > 0 && !confirmed) {
      confirmAction(
        {
          title: `Finish with ${formatSetsCount(remaining)} not logged?`,
          confirmLabel: 'Finish workout',
          cancelLabel: 'Keep logging',
          presentation: 'sheet',
        },
        () => finish(true),
      );
      return;
    }

    closed.current = true;
    const workout = completeWorkout({
      title: day.title,
      exercises,
      durationMinutes: sessionDurationMinutes(startedAt, updatedAtRef.current),
      startedAt,
      planId: plan.id,
      dayId: day.id,
    });
    clearLogSession({ planId: plan.id, dayId: day.id });
    hapticSuccess();
    void endWorkoutLiveActivity();
    router.replace(
      `/workout-complete?id=${encodeURIComponent(workout.id)}&planId=${encodeURIComponent(plan.id)}&dayId=${encodeURIComponent(day.id)}`,
    );
  };

  const persistOrder = (nextDrafts: DraftExercise[]) => {
    if (!plan || !day) {
      return;
    }
    const currentId = drafts[exerciseIndex]?.prescription.id;
    setDrafts(nextDrafts);
    if (currentId) {
      const nextIndex = nextDrafts.findIndex((item) => item.prescription.id === currentId);
      if (nextIndex >= 0) {
        setExerciseIndex(nextIndex);
      }
    }
    updatePlan(
      withDay(plan, day.id, (currentDay) => ({
        ...currentDay,
        // Orphans (left the plan, kept for their logged sets) never go back into it.
        exercises: nextDrafts.filter((item) => !item.orphan).map((item) => item.prescription),
      })),
    );
  };

  const swapCurrent = (next: ExercisePrescription) => {
    if (!current || !plan || !day) {
      return;
    }
    const swapped: ExercisePrescription = {
      ...clonePrescription(next),
      id: current.prescription.id,
      sets: current.prescription.sets,
      reps: current.prescription.reps,
      repScheme: current.prescription.repScheme ?? null,
    };
    const hadLogs = current.sets.some((set) => set.done);
    setEditing(null);
    setDrafts((items) => {
      const next = items.map((exercise, index) => {
        if (index !== exerciseIndex) {
          return exercise;
        }
        return {
          prescription: swapped,
          sets: hadLogs ? exercise.sets : buildDrafts([swapped], previousSetsForExercise)[0]?.sets ?? exercise.sets,
        };
      });
      return showTargets && !hadLogs ? prefillTargets(next, targetsFor, previousSetsForExercise) : next;
    });
    updatePlan(
      withDay(plan, day.id, (currentDay) => ({
        ...currentDay,
        exercises: currentDay.exercises.map((item) => (item.id === current.prescription.id ? swapped : item)),
      })),
    );
    setSheet(null);
  };

  if (!plan || !day || day.exercises.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.systemBackground,
          padding: 24,
          justifyContent: 'center',
          gap: 16,
        }}>
        <Text style={[type.planTitle, { textAlign: 'center' }]}>Start from a plan</Text>
        <Text style={[type.kicker, { textAlign: 'center' }]}>
          Open a training day from your plan.
        </Text>
        <Button title="Go to Workout" variant="black" onPress={() => router.replace('/')} />
      </View>
    );
  }

  const residueSets = current ? current.sets.filter((set) => set.done) : [];
  const nextTarget = exerciseComplete ? nextIncompleteIndex(drafts, exerciseIndex) : -1;
  const weightEmpty = wellValues?.weight == null && wellValues?.counterweight == null;

  let cta: { title: string; onPress: () => void; label?: string };
  let secondary: { title: string; onPress: () => void; label: string } | null = null;
  if (edit) {
    cta = { title: 'Update set', onPress: commitEdit };
    secondary = { title: 'Cancel', onPress: cancelEdit, label: 'Cancel editing this set' };
  } else if (activeSet) {
    const nudged = weightNudgeSetId === activeSet.id && showWeight && weightEmpty;
    cta = { title: nudged ? 'Log without weight' : 'Log set', onPress: completeSet };
    if (activeSet.extra) {
      secondary = {
        title: 'Cancel',
        onPress: () => removeExtraSet(activeSet.id),
        label: 'Remove the added set',
      };
    }
  } else if (nextTarget >= 0) {
    cta = { title: 'Next exercise', onPress: () => goToExercise(nextTarget) };
  } else {
    cta = { title: 'Finish workout', onPress: () => finish() };
  }

  // Free: `Target ›` opens the paywall once; a purchase or restore shows targets and
  // puts them in untouched wells. A dismissal hides the offer for the rest of this log.
  const unlockTargets = () => {
    Keyboard.dismiss();
    void requirePro('targets').then((unlocked) => {
      if (!unlocked) {
        setTargetOfferDismissed(true);
        return;
      }
      setTargetsUnlocked(true);
      setDrafts((items) => prefillTargets(items, targetsFor, previousSetsForExercise));
    });
  };
  const offerTargets = !showTargets && !targetOfferDismissed && rest == null && !edit && activeSet != null;

  const wellPatchFromDuration = (value: string): Partial<SetValues> => {
    const parsed = parsePositiveNumber(value);
    return { durationSeconds: parsed == null ? null : minutes ? Math.round(parsed * 60) : parsed };
  };

  return (
    <>
      <View style={{ flex: 1, backgroundColor: colors.systemBackground }}>
        <View
          style={{
            paddingTop: insets.top + 4,
            paddingHorizontal: 24,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
          <Pressable
            onPress={confirmDiscard}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cancel workout"
            testID="log-cancel"
            style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={[type.body, { color: colors.tertiaryLabel }]}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={() => finish()}
            accessibilityRole="button"
            accessibilityLabel="Finish workout"
            testID="log-finish"
            style={{
              minHeight: 44,
              minWidth: 72,
              alignItems: 'flex-end',
              justifyContent: 'center',
            }}>
            <Text style={[type.body, { fontWeight: '700' }]}>Finish</Text>
          </Pressable>
        </View>

        <View style={{ flex: 1, minHeight: 0 }}>
          {current ? (
            <>
              <View style={{ paddingHorizontal: 24, paddingTop: 8, flexShrink: 0 }}>
                <Pressable
                  testID="log-exercise-name"
                  onPress={() => openSheet('exercise')}
                  onLongPress={() => openSheet('day')}
                  delayLongPress={350}
                  accessibilityRole="button"
                  accessibilityLabel={current.prescription.name}
                  accessibilityHint="Shows exercise details and alternatives."
                  accessibilityActions={[{ name: 'activate' }, { name: 'openDay', label: 'Show the day' }]}
                  onAccessibilityAction={(event: AccessibilityActionEvent) =>
                    openSheet(event.nativeEvent.actionName === 'openDay' ? 'day' : 'exercise')
                  }
                  style={{ alignSelf: 'flex-start' }}>
                  {/* Chevron rides inline after the last word (iOS title-menu convention). */}
                  <Text
                    style={type.largeTitle}
                    numberOfLines={2}
                    maxFontSizeMultiplier={DISPLAY_TEXT_MAX_SCALE}>
                    {current.prescription.name}
                    {' '}
                    <View style={{ width: 17, height: 17, transform: [{ translateY: -3 }] }}>
                      <SymbolView
                        name="chevron.down"
                        size={17}
                        weight="semibold"
                        tintColor={colors.tertiaryLabel}
                        fallback={<ChevronFallback color={colors.tertiaryLabel} />}
                      />
                    </View>
                  </Text>
                </Pressable>
              </View>
              <View style={{ flexShrink: 0, paddingTop: 20 }}>
                <DayStrip
                  drafts={drafts}
                  selectedIndex={exerciseIndex}
                  onSelect={goToExercise}
                  onOpenDay={() => openSheet('day')}
                />
              </View>

              <ExerciseStage
                exerciseKey={current.prescription.id}
                canGoPrev={exerciseIndex > 0}
                canGoNext={exerciseIndex < drafts.length - 1}
                onPrev={() => goToExercise((value) => Math.max(0, value - 1))}
                onNext={() =>
                  goToExercise((value) => Math.min(drafts.length - 1, value + 1))
                }
                reduceMotion={Boolean(reduceMotion)}>
                <StageScroll>
                  <View style={{ paddingHorizontal: 24, paddingTop: 32, gap: 4, flexShrink: 0 }}>
                    <View
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 28 }}
                      accessible
                      accessibilityRole="header"
                      accessibilityLabel={
                        exerciseComplete && !edit ? `${current.prescription.name} done` : setHint
                      }>
                      <Text style={[type.title, { fontVariant: ['tabular-nums'] }]} testID="log-set-status">
                        {exerciseComplete && !edit ? 'Done' : (setHint ?? 'Set')}
                      </Text>
                      {exerciseComplete && !edit ? (
                        <SymbolView
                          name="checkmark"
                          size={17}
                          weight="bold"
                          tintColor={colors.systemGreen}
                          fallback={
                            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.systemGreen }}>
                              ✓
                            </Text>
                          }
                        />
                      ) : null}
                    </View>
                    <TargetLine
                      previousSets={previous?.sets}
                      setIndex={exerciseComplete && !edit ? 'all' : Math.max(0, stageSetIndex)}
                      minutes={minutes}
                      units={units}
                      target={stageTarget}
                      unlocked={showTargets}
                      onUnlock={offerTargets ? unlockTargets : undefined}
                    />
                  </View>

                  <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24, gap: 10 }}>
                    {residueSets.map((set) => (
                      <ResidueSetRow
                        key={set.id}
                        label={formatLoggedSetLine(set, { minutes })}
                        reduceMotion={Boolean(reduceMotion)}
                        resetKey={residueResetKeys[set.id] ?? 0}
                        editing={edit?.setId === set.id}
                        entering={
                          set.id === loggedPulseId
                            ? reduceMotion
                              ? FadeIn.duration(200)
                              : FadeInDown.duration(200).easing(EASE_OUT).withInitialValues({
                                  opacity: 0,
                                  transform: [{ translateY: -8 }],
                                })
                            : undefined
                        }
                        onPress={() => (edit?.setId === set.id ? cancelEdit() : beginEdit(set))}
                        onRequestDelete={() => confirmUndoSet(set)}
                      />
                    ))}
                    {exerciseComplete && !edit ? (
                      <Pressable
                        onPress={addSet}
                        testID="log-add-set"
                        accessibilityRole="button"
                        accessibilityLabel="Add set"
                        accessibilityHint="Adds one more set to this exercise for today only."
                        hitSlop={8}
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                          minHeight: 28,
                          alignSelf: 'flex-start',
                          paddingRight: 24,
                          opacity: pressed ? 0.5 : 1,
                        })}>
                        <SymbolView
                          name="plus"
                          size={17}
                          weight="semibold"
                          tintColor={colors.tertiaryLabel}
                          fallback={
                            <Text
                              style={{ width: 17, textAlign: 'center', fontSize: 17, color: colors.tertiaryLabel }}>
                              +
                            </Text>
                          }
                        />
                        <Text style={[type.body, { color: colors.tertiaryLabel }]}>Add set</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </StageScroll>
              </ExerciseStage>
            </>
          ) : null}
        </View>

        <KeyboardStickyView
          offset={{ closed: 0, opened: 0 }}
          style={{
            paddingHorizontal: 24,
            paddingTop: 0,
            paddingBottom: Math.max(insets.bottom, 12),
            gap: 16,
            backgroundColor: colors.systemBackground,
            zIndex: 1,
          }}>
          {rest != null ? (
            <Animated.View entering={REST_IN} exiting={REST_OUT}>
              <LogRest
                rest={rest}
                onSkip={() => setRest(null)}
                onAdjust={adjustRest}
                onExpire={() => setRest(null)}
              />
            </Animated.View>
          ) : null}

          {wellValues ? (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {showWeight ? (
                <LogWell
                  label={units.toUpperCase()}
                  a11yName={units === 'kg' ? 'Weight, kilograms' : 'Weight, pounds'}
                  a11yHint={setHint}
                  stepName="weight"
                  testID="log-well-weight"
                  inputRef={weightInputRef}
                  value={wellValues.weight == null ? '' : String(wellValues.weight)}
                  onChange={(value) => applyWellPatch({ weight: parsePositiveNumber(value) })}
                  step={WEIGHT_STEP[units]}
                  keyboard="decimal-pad"
                  focused={focusedWell === 'weight'}
                  dimmed={focusedWell != null && focusedWell !== 'weight'}
                  onFocus={() => focusWell('weight')}
                />
              ) : null}
              {showReps ? (
                <LogWell
                  label="REPS"
                  a11yName="Reps"
                  a11yHint={setHint}
                  stepName="reps"
                  testID="log-well-reps"
                  value={wellValues.reps == null ? '' : String(wellValues.reps)}
                  onChange={(value) => applyWellPatch({ reps: parsePositiveNumber(value) })}
                  step={1}
                  keyboard="number-pad"
                  focused={focusedWell === 'reps'}
                  dimmed={focusedWell != null && focusedWell !== 'reps'}
                  onFocus={() => focusWell('reps')}
                />
              ) : null}
              {showDuration ? (
                <LogWell
                  label={minutes ? 'MIN' : 'SEC'}
                  a11yName={minutes ? 'Minutes' : 'Seconds'}
                  a11yHint={setHint}
                  stepName={minutes ? 'minutes' : 'seconds'}
                  testID="log-well-duration"
                  value={
                    wellValues.durationSeconds == null
                      ? ''
                      : String(minutes ? Math.round(wellValues.durationSeconds / 60) : wellValues.durationSeconds)
                  }
                  onChange={(value) => applyWellPatch(wellPatchFromDuration(value))}
                  step={1}
                  keyboard="number-pad"
                  focused={focusedWell === 'duration'}
                  dimmed={focusedWell != null && focusedWell !== 'duration'}
                  onFocus={() => focusWell('duration')}
                />
              ) : null}
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
            {secondary ? (
              <Pressable
                onPress={secondary.onPress}
                accessibilityRole="button"
                accessibilityLabel={secondary.label}
                testID="log-cta-cancel"
                hitSlop={8}
                style={({ pressed }) => ({
                  minHeight: 52,
                  justifyContent: 'center',
                  opacity: pressed ? 0.5 : 1,
                })}>
                <Text style={[type.body, { color: colors.tertiaryLabel }]}>{secondary.title}</Text>
              </Pressable>
            ) : null}
            <Button
              title={cta.title}
              variant="green"
              testID="log-set"
              onPress={cta.onPress}
              style={{ flex: 1 }}
            />
          </View>
        </KeyboardStickyView>
      </View>

      <AnimatedSheet
        visible={sheet === 'day'}
        onClose={() => setSheet(null)}
        dragFrom="grabber">
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            paddingBottom: 12,
          }}>
          <Text style={type.title}>{day.title}</Text>
          <Text style={type.kicker}>Drag to reorder</Text>
        </View>
        <ScrollView bounces={false} style={{ maxHeight: 480 }}>
          {drafts.map((exercise, index) => {
            const done = exercise.sets.filter((set) => set.done).length;
            const progress = `${done} of ${exercise.sets.length}`;
            return (
              <DaySheetRow
                key={exercise.prescription.id}
                name={exercise.prescription.name}
                meta={index === exerciseIndex ? `Now · ${progress}` : progress}
                complete={exerciseIsComplete(exercise)}
                index={index}
                count={drafts.length}
                onJump={() => {
                  goToExercise(index);
                  setSheet(null);
                }}
                onMove={(from, to) => persistOrder(moveItem(drafts, from, to))}
              />
            );
          })}
        </ScrollView>
        <View style={{ height: Math.max(insets.bottom, 10) }} />
      </AnimatedSheet>

      <AnimatedSheet
        visible={sheet === 'exercise'}
        onClose={() => setSheet(null)}
        dragFrom="sheet">
        {current ? (
          <LogExerciseSheet
            exercise={current.prescription}
            previous={previous}
            best={bestSetForExercise(workoutHistory, current.prescription.name)}
            targets={showTargets ? currentTargets : null}
            units={units}
            minutes={minutes}
            alternatives={alternativesFor(current.prescription, catalog)}
            onSwap={swapCurrent}
          />
        ) : null}
        <View style={{ height: Math.max(insets.bottom, 10) }} />
      </AnimatedSheet>

      <Stack.Screen options={{ headerShown: false, title: day.title, gestureEnabled: false }} />
    </>
  );
}

/** Web and older iOS without SF Symbols: a drawn chevron in the same 17pt box. */
function ChevronFallback({ color }: { color: string }) {
  return (
    <View style={{ width: 17, height: 17, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: 9,
          height: 9,
          marginTop: -5,
          borderRightWidth: 2,
          borderBottomWidth: 2,
          borderColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

/**
 * Upper stage body (set status, last time, logged sets). Scrolls only when it no
 * longer fits (large Dynamic Type, many sets); otherwise it is a plain, pinned column.
 */
function StageScroll({ children }: { children: ReactNode }) {
  const size = useRef({ viewport: 0, content: 0 });
  const [scrollable, setScrollable] = useState(false);
  const measure = (patch: Partial<{ viewport: number; content: number }>) => {
    size.current = { ...size.current, ...patch };
    const next = size.current.content > size.current.viewport + 1;
    setScrollable((value) => (value === next ? value : next));
  };
  return (
    <GestureScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1 }}
      bounces={false}
      overScrollMode="never"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      scrollEnabled={scrollable}
      onLayout={(event) => measure({ viewport: event.nativeEvent.layout.height })}
      onContentSizeChange={(_width, height) => measure({ content: height })}>
      {children}
    </GestureScrollView>
  );
}

function DayStrip({
  drafts,
  selectedIndex,
  onSelect,
  onOpenDay,
}: {
  drafts: DraftExercise[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onOpenDay: () => void;
}) {
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const chipX = useRef<number[]>([]);

  useEffect(() => {
    const x = chipX.current[selectedIndex];
    if (x == null) {
      return;
    }
    scrollRef.current?.scrollTo({ x: Math.max(0, x - 24), animated: true });
  }, [selectedIndex]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{
        gap: 6,
        paddingLeft: 24,
        paddingRight: 24,
        alignItems: 'center',
      }}>
      {drafts.map((exercise, index) => {
        const complete = exerciseIsComplete(exercise);
        const selected = index === selectedIndex;
        const selectedComplete = selected && complete;
        const label = exercise.prescription.name;
        return (
          <Pressable
            key={exercise.prescription.id}
            testID={`log-chip-${index}`}
            onLayout={(event) => {
              chipX.current[index] = event.nativeEvent.layout.x;
            }}
            onPress={() => {
              if (selected) {
                onOpenDay();
                return;
              }
              onSelect(index);
            }}
            onLongPress={onOpenDay}
            delayLongPress={320}
            accessibilityRole="button"
            accessibilityLabel={complete ? `${exercise.prescription.name}, done` : exercise.prescription.name}
            accessibilityState={{ selected }}
            accessibilityHint={selected ? 'Opens the day so you can reorder' : 'Jump to this exercise'}
            accessibilityActions={[{ name: 'activate' }, { name: 'openDay', label: 'Show the day' }]}
            onAccessibilityAction={(event: AccessibilityActionEvent) => {
              if (event.nativeEvent.actionName === 'openDay' || selected) {
                onOpenDay();
                return;
              }
              onSelect(index);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingVertical: 8,
              paddingHorizontal: CHIP_PAD_X,
              borderRadius: radius.full,
              backgroundColor: selected
                ? complete
                  ? colors.systemGreen
                  : colors.secondarySystemBackground
                : 'transparent',
            }}>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 15,
                lineHeight: 20,
                fontWeight: selected || complete ? '500' : '400',
                color: selectedComplete
                  ? colors.onGreen
                  : selected || complete
                    ? colors.label
                    : colors.tertiaryLabel,
              }}>
              {label}
            </Text>
            {complete ? (
              <SymbolView
                name="checkmark"
                size={12}
                weight="bold"
                tintColor={selected ? colors.onGreen : colors.systemGreen}
              />
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function ExerciseStage({
  children,
  exerciseKey,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  reduceMotion,
}: {
  children: ReactNode;
  exerciseKey: string;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  reduceMotion: boolean;
}) {
  const translateX = useSharedValue(0);
  const dragX = useSharedValue(0);
  const contextX = useSharedValue(0);
  const canGoPrevShared = useSharedValue(canGoPrev);
  const canGoNextShared = useSharedValue(canGoNext);
  const onPrevRef = useRef(onPrev);
  const onNextRef = useRef(onNext);

  useEffect(() => {
    onPrevRef.current = onPrev;
    onNextRef.current = onNext;
  }, [onNext, onPrev]);

  useEffect(() => {
    canGoPrevShared.set(canGoPrev);
    canGoNextShared.set(canGoNext);
  }, [canGoNext, canGoNextShared, canGoPrev, canGoPrevShared]);

  useEffect(() => {
    dragX.set(0);
    if (reduceMotion) {
      translateX.set(0);
      return;
    }
    translateX.set(12);
    translateX.set(withTiming(0, { duration: 140, easing: EASE_OUT }));
  }, [dragX, exerciseKey, reduceMotion, translateX]);

  const commitPrev = () => {
    dragX.set(0);
    if (process.env.EXPO_OS === 'ios') {
      void Haptics.selectionAsync();
    }
    onPrevRef.current();
  };

  const commitNext = () => {
    dragX.set(0);
    if (process.env.EXPO_OS === 'ios') {
      void Haptics.selectionAsync();
    }
    onNextRef.current();
  };

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // Higher than ResidueSetRow so a set swipe wins before exercise change.
        .activeOffsetX([-28, 28])
        .failOffsetY([-12, 12])
        .onStart(() => {
          contextX.set(dragX.get());
        })
        .onUpdate((event) => {
          const next = contextX.get() + event.translationX;
          if (next > 0 && !canGoPrevShared.get()) {
            dragX.set(next * 0.22);
            return;
          }
          if (next < 0 && !canGoNextShared.get()) {
            dragX.set(next * 0.22);
            return;
          }
          dragX.set(next);
        })
        .onEnd((event) => {
          const projected = dragX.get() + project(event.velocityX);
          if (projected < -SWIPE_DISTANCE && canGoNextShared.get()) {
            scheduleOnRN(commitNext);
            return;
          }
          if (projected > SWIPE_DISTANCE && canGoPrevShared.get()) {
            scheduleOnRN(commitPrev);
            return;
          }
          dragX.set(
            withSpring(0, {
              duration: 400,
              dampingRatio: 0.8,
              velocity: event.velocityX,
              reduceMotion: ReduceMotion.System,
            }),
          );
        }),
    [canGoNextShared, canGoPrevShared, contextX, dragX],
  );

  const stageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.get() + translateX.get() }],
    opacity: reduceMotion
      ? 1
      : Math.max(0.62, 1 - Math.min(1, Math.abs(dragX.get()) / 240)),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[{ flex: 1, minHeight: 0 }, stageStyle]}>{children}</Animated.View>
    </GestureDetector>
  );
}

function LogWell({
  label,
  a11yName,
  a11yHint,
  stepName,
  value,
  onChange,
  step,
  keyboard,
  focused,
  dimmed,
  onFocus,
  inputRef,
  testID,
}: {
  label: string;
  /** VoiceOver name: `Weight, kilograms`, `Reps`, `Seconds`. */
  a11yName: string;
  /** `Set 2 of 4`. */
  a11yHint?: string;
  /** Stepper wording: `Decrease weight by 2.5`. */
  stepName: string;
  value: string;
  onChange: (value: string) => void;
  step: number;
  keyboard: 'decimal-pad' | 'number-pad';
  focused: boolean;
  dimmed: boolean;
  onFocus: () => void;
  inputRef?: RefObject<TextInput | null>;
  testID?: string;
}) {
  const { colors } = useTheme();
  const nudge = (delta: number) => {
    if (process.env.EXPO_OS === 'ios') {
      void Haptics.selectionAsync();
    }
    onChange(nudgeString(value, delta));
  };
  const stepperStyle = ({ pressed }: { pressed: boolean }) => ({
    flex: 1,
    minHeight: 44,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: pressed ? colors.systemGray5 : 'transparent',
  });
  return (
    <Animated.View
      style={{
        flex: 1,
        gap: 8,
        opacity: dimmed ? 0.45 : 1,
        transitionProperty: 'opacity',
        transitionDuration: '150ms',
        transitionTimingFunction: 'ease',
      }}>
      <Text
        importantForAccessibility="no"
        accessibilityElementsHidden
        style={{
          fontSize: 13,
          fontWeight: '500',
          letterSpacing: 0.04 * 13,
          lineHeight: 16,
          color: colors.tertiaryLabel,
        }}>
        {label}
      </Text>
      <Animated.View
        style={{
          borderRadius: radius.md,
          borderCurve: 'continuous',
          overflow: 'hidden',
          backgroundColor: focused ? colors.systemBackground : colors.secondarySystemBackground,
          borderWidth: 2,
          borderColor: focused ? colors.label : 'transparent',
          transitionProperty: ['backgroundColor', 'borderColor'],
          transitionDuration: '150ms',
          transitionTimingFunction: 'ease',
        }}>
        <TextInput
          ref={inputRef}
          testID={testID}
          value={value}
          onChangeText={onChange}
          onFocus={onFocus}
          keyboardType={keyboard}
          placeholder="—"
          placeholderTextColor={colors.tertiaryLabel}
          underlineColorAndroid="transparent"
          accessibilityLabel={a11yName}
          accessibilityHint={a11yHint}
          maxFontSizeMultiplier={WELL_TEXT_MAX_SCALE}
          style={{
            minHeight: 68,
            textAlign: 'center',
            fontSize: 34,
            fontWeight: '700',
            letterSpacing: -0.02 * 34,
            color: colors.label,
            fontVariant: ['tabular-nums'],
            paddingVertical: 0,
          }}
        />
        <View
          style={{
            flexDirection: 'row',
            minHeight: 44,
            borderTopWidth: 0.5,
            borderTopColor: colors.systemGray4,
          }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Decrease ${stepName} by ${step}`}
            onPress={() => nudge(-step)}
            style={stepperStyle}>
            <Text
              maxFontSizeMultiplier={WELL_TEXT_MAX_SCALE}
              style={{ fontSize: 20, lineHeight: 24, color: colors.secondaryLabel }}>
              −
            </Text>
          </Pressable>
          <View style={{ width: 0.5, backgroundColor: colors.systemGray4 }} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Increase ${stepName} by ${step}`}
            onPress={() => nudge(step)}
            style={stepperStyle}>
            <Text
              maxFontSizeMultiplier={WELL_TEXT_MAX_SCALE}
              style={{ fontSize: 20, lineHeight: 24, color: colors.secondaryLabel }}>
              +
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function DaySheetRow({
  name,
  meta,
  complete,
  index,
  count,
  onJump,
  onMove,
}: {
  name: string;
  meta: string;
  complete: boolean;
  index: number;
  count: number;
  onJump: () => void;
  onMove: (from: number, to: number) => void;
}) {
  const { colors, type } = useTheme();
  const translateY = useSharedValue(0);
  const contextY = useSharedValue(0);
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(160)
        .onStart(() => {
          contextY.set(translateY.get());
        })
        .onUpdate((event) => {
          translateY.set(contextY.get() + event.translationY);
        })
        .onEnd((event) => {
          const delta = Math.round(translateY.get() / 52);
          translateY.set(
            withSpring(0, {
              duration: 400,
              dampingRatio: 0.8,
              velocity: event.velocityY,
              reduceMotion: ReduceMotion.System,
            }),
          );
          if (delta !== 0) {
            scheduleOnRN(onMove, index, index + delta);
          }
        }),
    [contextY, index, onMove, translateY],
  );
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() }],
  }));

  const actions = [
    { name: 'activate', label: 'Go to exercise' },
    ...(index > 0 ? [{ name: 'moveUp', label: 'Move up' }] : []),
    ...(index < count - 1 ? [{ name: 'moveDown', label: 'Move down' }] : []),
  ];
  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    switch (event.nativeEvent.actionName) {
      case 'moveUp':
        onMove(index, index - 1);
        return;
      case 'moveDown':
        onMove(index, index + 1);
        return;
      default:
        onJump();
    }
  };

  return (
    <Animated.View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 12,
        },
        animatedStyle,
      ]}>
      <GestureDetector gesture={gesture}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            width: 44,
            minHeight: 44,
            marginLeft: -10,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
          <SymbolView
            name="line.3.horizontal"
            size={16}
            tintColor={colors.tertiaryLabel}
            fallback={<Text style={{ fontSize: 16, color: colors.tertiaryLabel }}>≡</Text>}
          />
        </View>
      </GestureDetector>
      <Pressable
        onPress={onJump}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${complete ? 'done' : meta}`}
        accessibilityActions={actions}
        onAccessibilityAction={onAccessibilityAction}
        style={{ flex: 1, paddingLeft: 2, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={type.row}>{name}</Text>
          <Text style={[type.kicker, { fontVariant: ['tabular-nums'] }]}>{meta}</Text>
        </View>
        {complete ? (
          <SymbolView
            name="checkmark"
            size={17}
            weight="bold"
            tintColor={colors.systemGreen}
            fallback={<Text style={{ fontSize: 17, fontWeight: '700', color: colors.systemGreen }}>✓</Text>}
          />
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

/** Exercise fact sheet (no media): plan, last time, best — then Alternatives to swap. */
function LogExerciseSheet({
  exercise,
  previous,
  best,
  targets,
  units,
  minutes,
  alternatives,
  onSwap,
}: {
  exercise: ExercisePrescription;
  previous: PreviousExerciseLog | null;
  best: BestSet | null;
  /** Pro only: today's target for every set. */
  targets: (SetTarget | null)[] | null;
  units: 'kg' | 'lbs';
  minutes: boolean;
  alternatives: ExercisePrescription[];
  onSwap: (next: ExercisePrescription) => void;
}) {
  const { type } = useTheme();
  const muscle = exercise.targetMuscles[0];
  const equipment = exercise.equipments[0];
  const detail = [muscle, equipment].filter(Boolean).join(' · ');
  const targetSets = targets?.every((target) => target != null) ? (targets as SetTarget[]) : null;
  const facts: { label: string; value: string; spoken?: string }[] = [
    { label: 'Plan', value: formatPlanMetric(exercise) },
    {
      label: 'Last time',
      value: previous
        ? `${formatSetsCompact(previous.sets, { minutes })} · ${formatHistoryWhenInMonth(previous.completedAt)}`
        : 'First time',
    },
    ...(targetSets
      ? [
          {
            label: 'Next target',
            value: formatSetsCompact(
              targetSets.map((target, index) => ({ ...target, id: `target-${index}`, index: index + 1 })),
              { minutes },
            ),
            spoken: spokenTargets(targetSets, units),
          },
        ]
      : []),
    ...(best
      ? [
          {
            label: 'Best',
            value: `${formatLoggedSetLine(best.set, { minutes })} · ${formatShortDate(best.completedAt)}`,
          },
        ]
      : []),
  ];

  return (
    <View>
      <View style={{ gap: 6, paddingBottom: 12 }}>
        <Text style={type.title}>{exercise.name}</Text>
        {detail ? <Text style={type.kicker}>{detail}</Text> : null}
      </View>
      <View style={{ paddingBottom: 16 }}>
        {facts.map((fact) => (
          <FactRow key={fact.label} label={fact.label} value={fact.value} spoken={fact.spoken} />
        ))}
      </View>
      {alternatives.length > 0 ? (
        <>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingTop: 8,
              paddingBottom: 4,
            }}>
            <Text style={type.kicker}>Alternatives</Text>
            <Text style={type.kicker}>Tap to swap</Text>
          </View>
          {alternatives.map((item) => (
            <PaperRow
              key={item.id}
              title={item.name}
              meta={item.equipments[0] ?? item.targetMuscles[0]}
              onPress={() => onSwap(item)}
            />
          ))}
        </>
      ) : null}
    </View>
  );
}

function FactRow({ label, value, spoken }: { label: string; value: string; spoken?: string }) {
  const { colors, type } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${spoken ?? value}`}
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 16,
        minHeight: 44,
        paddingVertical: 11,
      }}>
      <Text style={[type.body, { flexShrink: 0 }]}>{label}</Text>
      <Text
        numberOfLines={1}
        style={[
          type.kicker,
          { fontWeight: '400', flexShrink: 1, textAlign: 'right', color: colors.secondaryLabel, fontVariant: ['tabular-nums'] },
        ]}>
        {value}
      </Text>
    </View>
  );
}
