import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  AccessibilityInfo,
  AppState,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
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
  Extrapolation,
  FadeIn,
  FadeInLeft,
  FadeInRight,
  FadeInUp,
  FadeOut,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedSheet } from '@/components/animated-sheet';
import { Button } from '@/components/button';
import { confirmAction } from '@/components/confirm-action';
import { LogRest } from '@/components/log-rest';
import { StaggerValue } from '@/components/stagger-value';
import { PaperRow } from '@/components/paper';
import { ResidueSetRow } from '@/components/residue-set-row';
import { TargetLine } from '@/components/target-line';
import { exerciseStillMediaURL, offlineCatalogExercises } from '@/catalog';
import { iconSize, PRESSED_OPACITY, radius, space, TOUCH_TARGET } from '@/constants/theme';
import {
  clonePrescription,
  durationIsMinutes,
  emptyLoggedSet,
  formatHistoryWhenInMonth,
  exerciseDetail,
  formatLoggedSetLine,
  formatPlanMetric,
  formatSetsCount,
  parsePositiveNumber,
  spokenWhen,
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
import { DURATION, EASE_OUT, ENTER_OFFSET, SPRING } from '@/motion';
import {
  newId,
  type ExercisePrescription,
  type LoggedExercise,
  type LoggedSet,
} from '@/domain/types';
import { endWorkoutLiveActivity, loadWorkoutFocus, syncWorkoutLiveActivity } from '@/live-activity/controller';
import { parseWorkoutLogUrl, workoutLogHref } from '@/live-activity/url';
import { openExerciseReplace } from '@/navigation/exercise-replace';
import { upcomingExerciseIndex } from '@/live-activity/upcoming';
import { requirePro } from '@/purchases/pro-gate';
import { useWorkoutStore, type PreviousExerciseLog } from '@/store/workout-store';
import { useTheme } from '@/theme/theme-context';
import { track } from '@/analytics/analytics';
import { workoutPersonalBests } from '@/domain/set-lines';

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
/** Horizontal travel before the stage takes the pan (subtracted, so pages never jump). */
const STAGE_PAN_SLOP = 14;
/** Past the first or last exercise the page follows at this fraction (rubber band). */
const STAGE_EDGE_RESISTANCE = 0.22;
/** A neighbour one page away; it brightens as it arrives. */
const STAGE_NEIGHBOUR_OPACITY = 0.5;
const NOOP = () => {};
const CHIP_PAD_X = 12;
// Rest arrives with the set it follows: every-set tier, 150ms at most (trim-ui §8).
const REST_IN = FadeIn.duration(DURATION.exit).easing(EASE_OUT);
const REST_OUT = FadeOut.duration(DURATION.press).easing(EASE_OUT);
/** Typing in a well settles before it is written; set logs land within this too. */
const SESSION_WRITE_DEBOUNCE_MS = 400;
/** Start moment: if the modal's `transitionEnd` never comes (web), light up anyway. */
const START_LAND_FALLBACK_MS = 700;
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
  const params = useLocalSearchParams<{
    planId?: string;
    dayId?: string;
    exerciseId?: string;
    start?: string;
  }>();
  const planId = firstParam(params.planId);
  const dayId = firstParam(params.dayId);
  const exerciseIdParam = firstParam(params.exerciseId);
  const router = useRouter();
  const navigation = useNavigation();
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

  // --- Start moment (trim-ui §8 Workout starts) ----------------------------
  // Only a fresh Start: `Log set` rides up with the modal in the quiet gray and lights green
  // on the frame the modal lands, with one medium impact. Resume, a Live Activity reopen or
  // a restored session open lit. Log set is tappable throughout; nothing waits on this.
  const [startMoment] = useState(
    () => firstParam(params.start) === '1' && !opened.restored && conflict == null,
  );
  const [ctaLit, setCtaLit] = useState(!startMoment);
  useEffect(() => {
    if (!startMoment) {
      return;
    }
    let lit = false;
    const light = () => {
      if (lit) {
        return;
      }
      lit = true;
      setCtaLit(true);
      if (process.env.EXPO_OS === 'ios') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    };
    const timer = setTimeout(light, START_LAND_FALLBACK_MS);
    const unsubscribe = navigation.addListener(
      'transitionEnd' as never,
      (event: { data?: { closing?: boolean } }) => {
        if (!event.data?.closing) {
          light();
        }
      },
    );
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [navigation, startMoment]);
  const [rest, setRest] = useState<RestWindow | null>(opened.rest);
  // Rest ran out or was skipped: the Live Activity reads `Go` until the next rest starts.
  const [restOver, setRestOver] = useState(false);
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
  // A set logged from the keyboard (typically the first set of an exercise, where the weight
  // gets typed) must not grow the docked footer: inserted there, rest pushes the footer up
  // over `Set n of m`, then rides the keyboard down. It appears once the keyboard is down.
  const [restHeldForKeyboard, setRestHeldForKeyboard] = useState(false);
  const holdRest = restHeldForKeyboard && keyboardOpen;
  const openSheet = (next: 'day' | 'exercise') => {
    Keyboard.dismiss();
    setSheet(next);
  };
  /** Every exercise change drops a pending edit / weight nudge; they belong to one set. */
  const selectExercise = (next: number) => {
    setEditing(null);
    setWeightNudgeSetId(null);
    setExerciseIndex(next);
  };
  const { width: stageWidth } = useWindowDimensions();
  // Name and stage page together; a swipe commits on release (the pager already settles there).
  const pager = useExercisePager({
    index: exerciseIndex,
    count: drafts.length,
    contentKey: drafts[exerciseIndex]?.prescription.name ?? '',
    width: stageWidth,
    reduceMotion: Boolean(reduceMotion),
    onCommit: selectExercise,
  });
  /** A tap (strip, Next exercise, auto-advance): the stage moves on the same frame. */
  const goToExercise = (next: number) => {
    pager.jumpTo(next);
    selectExercise(next);
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
    setRestOver(false);
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
      restOver,
    });
  }, [dayId, nextExerciseId, nextExerciseName, nextImageURL, planId, rest, restOver]);

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
    setRestHeldForKeyboard(false);
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
    setRestHeldForKeyboard(keyboardOpen && rest == null);
    setWellFocus(null);
    setWeightNudgeSetId(null);
    Keyboard.dismiss();
    if (process.env.EXPO_OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    track('set_logged', { set_number: setIndex + 1 });
    // No rest after the last set of the whole workout.
    if (unloggedSetCount(nextDrafts) > 0) {
      startRest(restSecondsForExercise(current.prescription));
    } else {
      setRest(null);
    }
    if (exerciseIsComplete(nextDrafts[exerciseIndex])) {
      const advanceTo = nextIncompleteIndex(nextDrafts, exerciseIndex, { wrap: false });
      if (advanceTo >= 0) {
        // Same frame as the tap: every set is the highest-frequency moment in the app, so
        // nothing waits between Log set and the next exercise (trim-ui → Motion).
        goToExercise(advanceTo);
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
    const line = formatLoggedSetLine(set, { minutes, unit: units });
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
    track('workout_completed', {
      exercises: workout.exercises.length,
      sets: workout.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0),
      duration_minutes: workout.durationMinutes,
      prs: workoutPersonalBests(workout, workoutHistory).count,
    });
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

  /**
   * Puts `next` in place of the exercise `targetId` (Alternatives, Choose another exercise):
   * same slot, same sets and reps; logged sets stay, untouched ones re-prefill for `next`.
   */
  const swapExercise = (targetId: string, next: ExercisePrescription) => {
    const target = drafts.find((item) => item.prescription.id === targetId);
    if (!target || !plan || !day) {
      return;
    }
    const swapped: ExercisePrescription = {
      ...clonePrescription(next),
      id: target.prescription.id,
      sets: target.prescription.sets,
      reps: target.prescription.reps,
      repScheme: target.prescription.repScheme ?? null,
    };
    const hadLogs = target.sets.some((set) => set.done);
    setEditing(null);
    setDrafts((items) => {
      const next = items.map((exercise) => {
        if (exercise.prescription.id !== targetId) {
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
        exercises: currentDay.exercises.map((item) => (item.id === targetId ? swapped : item)),
      })),
    );
    setSheet(null);
  };

  // The picker answers after this render; it swaps with the log as it is then.
  const swapExerciseRef = useRef(swapExercise);
  useEffect(() => {
    swapExerciseRef.current = swapExercise;
  });
  const replaceRequest = useRef<{ id: string; close: () => void } | null>(null);
  useEffect(() => () => replaceRequest.current?.close(), []);

  /** Any exercise, not only Alternatives: the picker in replace mode, one tap swaps. */
  const chooseAnotherExercise = () => {
    if (!current || !plan || !day) {
      return;
    }
    const targetId = current.prescription.id;
    replaceRequest.current?.close();
    const request = openExerciseReplace((exercise) => swapExerciseRef.current(targetId, exercise));
    replaceRequest.current = request;
    setSheet(null);
    router.push(`/exercises?planId=${plan.id}&dayId=${day.id}&from=log&replace=${request.id}`);
  };

  if (!plan || !day || day.exercises.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.systemBackground,
          padding: space.gutter,
          justifyContent: 'center',
          gap: space.inset,
        }}>
        {/* A fact and one action (trim-ui §10 Empty); no helper line. */}
        <Text style={[type.title, { textAlign: 'center' }]}>No workout open</Text>
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
            paddingHorizontal: space.gutter,
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
            <Text style={[type.button, { color: colors.brand }]}>Finish</Text>
          </Pressable>
        </View>

        <View style={{ flex: 1, minHeight: 0 }}>
          {current ? (
            <>
              {/* Names page with the stage (same position), so the neighbour's name is already there. */}
              <View style={{ flexShrink: 0, overflow: 'hidden' }}>
                {drafts.map((draft, index) => (
                  <PagerPage
                    key={draft.prescription.id}
                    index={index}
                    current={index === exerciseIndex}
                    layout="flow"
                    pager={pager}>
                    <ExerciseName
                      name={draft.prescription.name}
                      onOpen={index === exerciseIndex ? openSheet : undefined}
                    />
                  </PagerPage>
                ))}
              </View>
              <View style={{ flexShrink: 0, paddingTop: space.gutter }}>
                <DayStrip
                  drafts={drafts}
                  selectedIndex={exerciseIndex}
                  onSelect={goToExercise}
                  onOpenDay={() => openSheet('day')}
                />
              </View>

              <GestureDetector gesture={pager.gesture}>
                <View style={{ flex: 1, minHeight: 0 }}>
                  {drafts.map((draft, index) =>
                    index === exerciseIndex ? (
                      <PagerPage key={draft.prescription.id} index={index} current layout="fill" pager={pager}>
                        <StageScroll>
                          <View style={STAGE_HEAD}>
                            <SetStatus
                              label={exerciseComplete && !edit ? 'Done' : (setHint ?? 'Set')}
                              set={
                                stageSetIndex >= 0
                                  ? { number: stageSetIndex + 1, of: current.sets.length }
                                  : undefined
                              }
                              complete={exerciseComplete && !edit}
                              accessibilityLabel={
                                exerciseComplete && !edit ? `${current.prescription.name} done` : setHint
                              }
                              testID="log-set-status"
                            />
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

                          <View style={STAGE_SETS}>
                            {residueSets.map((set) => (
                              <ResidueSetRow
                                key={set.id}
                                label={formatLoggedSetLine(set, { minutes, unit: units })}
                                reduceMotion={Boolean(reduceMotion)}
                                resetKey={residueResetKeys[set.id] ?? 0}
                                editing={edit?.setId === set.id}
                                entering={
                                  set.id === loggedPulseId
                                    ? reduceMotion
                                      ? FadeIn.duration(DURATION.fade)
                                      : // Rises from the wells, where the value came from (nothing teleports).
                                        // Every-set tier: 150ms at most.
                                        FadeInUp.duration(DURATION.exit).easing(EASE_OUT).withInitialValues({
                                          opacity: 0,
                                          transform: [{ translateY: ENTER_OFFSET }],
                                        })
                                    : undefined
                                }
                                onPress={() => (edit?.setId === set.id ? cancelEdit() : beginEdit(set))}
                                onRequestDelete={() => confirmUndoSet(set)}
                              />
                            ))}
                            {exerciseComplete && !edit ? <AddSetRow onPress={addSet} /> : null}
                          </View>
                        </StageScroll>
                      </PagerPage>
                    ) : (
                      <PagerPage key={draft.prescription.id} index={index} current={false} layout="fill" pager={pager}>
                        <StagePreview
                          draft={draft}
                          previousSets={previousLogForExercise(draft.prescription.name)?.sets ?? null}
                          targetsFor={showTargets || !targetOfferDismissed ? targetsFor : null}
                          showTargets={showTargets}
                          offerTarget={!showTargets && !targetOfferDismissed && rest == null}
                          units={units}
                        />
                      </PagerPage>
                    ),
                  )}
                </View>
              </GestureDetector>
            </>
          ) : null}
        </View>

        <KeyboardStickyView
          offset={{ closed: 0, opened: 0 }}
          style={{
            paddingHorizontal: space.gutter,
            paddingTop: 0,
            paddingBottom: Math.max(insets.bottom, 12),
            gap: space.inset,
            backgroundColor: colors.systemBackground,
            zIndex: 1,
          }}>
          {rest != null && !holdRest ? (
            <Animated.View entering={REST_IN} exiting={REST_OUT}>
              <LogRest
                rest={rest}
                onSkip={() => {
                  setRest(null);
                  setRestOver(true);
                }}
                onAdjust={adjustRest}
                onExpire={() => setRest(null)}
                onGo={() => setRestOver(true)}
              />
            </Animated.View>
          ) : null}

          {wellValues ? (
            <View style={{ flexDirection: 'row', gap: space.inline }}>
              {showWeight ? (
                <LogWell
                  label={units}
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
                  label="reps"
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
                  label={minutes ? 'min' : 'sec'}
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

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.gutter }}>
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
                  opacity: pressed ? PRESSED_OPACITY : 1,
                })}>
                <Text style={[type.body, { color: colors.tertiaryLabel }]}>{secondary.title}</Text>
              </Pressable>
            ) : null}
            <Button
              title={cta.title}
              variant="green"
              testID="log-set"
              onPress={cta.onPress}
              unlit={!ctaLit}
              style={{ flex: 1 }}
            />
          </View>
        </KeyboardStickyView>
      </View>

      <AnimatedSheet
        visible={sheet === 'day'}
        onClose={() => setSheet(null)}
        dragFrom="grabber">
        <View style={{ paddingBottom: space.inline }}>
          <Text style={type.title}>{day.title}</Text>
        </View>
        <ScrollView bounces={false} style={{ maxHeight: 480 }}>
          {drafts.map((exercise, index) => {
            const done = exercise.sets.filter((set) => set.done).length;
            const progress = `${done} of ${exercise.sets.length}`;
            return (
              <DaySheetRow
                key={exercise.prescription.id}
                name={exercise.prescription.name}
                meta={progress}
                current={index === exerciseIndex}
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
        dragFrom="sheet"
        morph>
        {current ? (
          <LogExerciseSheet
            exercise={current.prescription}
            previous={previous}
            best={bestSetForExercise(workoutHistory, current.prescription.name)}
            targets={showTargets ? currentTargets : null}
            units={units}
            alternatives={alternativesFor(current.prescription, catalog)}
            previousFor={previousLogForExercise}
            bestFor={(name) => bestSetForExercise(workoutHistory, name)}
            onSwap={(next) => swapExercise(current.prescription.id, next)}
            onChooseAnother={chooseAnotherExercise}
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
  const { colors, type } = useTheme();
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
        gap: space.related,
        paddingLeft: space.gutter,
        paddingRight: space.gutter,
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
              gap: space.tight,
              paddingVertical: space.related,
              paddingHorizontal: CHIP_PAD_X,
              borderRadius: radius.full,
              backgroundColor: selected
                ? complete
                  ? colors.systemGreen
                  : colors.brand
                : 'transparent',
            }}>
            <Text
              numberOfLines={1}
              style={{
                ...type.caption,
                color: selectedComplete
                  ? colors.onGreen
                  : selected
                    ? colors.onBrand
                    : complete
                      ? colors.label
                      : colors.tertiaryLabel,
              }}>
              {label}
            </Text>
            {complete ? (
              <SymbolView
                name="checkmark"
                size={iconSize.caption}
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

type ExercisePager = {
  /** The stage position in exercises (fractional while a page is between). */
  pos: SharedValue<number>;
  /** A tap's 8pt arrival from the side you moved toward (px). */
  nudge: SharedValue<number>;
  width: number;
  gesture: ReturnType<typeof Gesture.Pan>;
  /** Move the stage to `next` now (a tap), arriving from the side it lies on. */
  jumpTo: (next: number) => void;
};

/**
 * One position drives the exercise name and the stage, so every page, neighbours included,
 * sits where the finger puts it (trim-ui §8 Log stage swaps exercise). The pan tracks 1:1
 * from its first frame, commits on distance or a flick (projected ≥ `SWIPE_DISTANCE`), and
 * the release hands its velocity to `SPRING.fling`. React learns the new index on release,
 * so the wells switch while the page is still settling; nothing re-renders mid-drag.
 */
function useExercisePager({
  index,
  count,
  contentKey,
  width,
  reduceMotion,
  onCommit,
}: {
  index: number;
  count: number;
  /** The current exercise's name: a swap in place re-enters like a tap. */
  contentKey: string;
  width: number;
  reduceMotion: boolean;
  onCommit: (next: number) => void;
}): ExercisePager {
  const pos = useSharedValue(index);
  const nudge = useSharedValue(0);
  const indexShared = useSharedValue(index);
  const countShared = useSharedValue(count);
  const startPos = useSharedValue(index);
  const startX = useSharedValue(0);
  // Where the pages were last sent (tap or swipe), so an index change from elsewhere
  // (Live Activity focus, reordering) still lands, and a swipe's own commit doesn't re-jump.
  const shownIndex = useRef(index);
  const shownKey = useRef(contentKey);
  const onCommitRef = useRef(onCommit);

  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  const arrive = useCallback(
    (direction: number) => {
      if (reduceMotion) {
        nudge.set(0);
        return;
      }
      nudge.set(ENTER_OFFSET * direction);
      nudge.set(withTiming(0, { duration: DURATION.press, easing: EASE_OUT }));
    },
    [nudge, reduceMotion],
  );

  const jumpTo = useCallback(
    (next: number) => {
      const from = shownIndex.current;
      shownIndex.current = next;
      pos.set(next);
      if (next !== from) {
        arrive(next < from ? -1 : 1);
      }
    },
    [arrive, pos],
  );

  const lastIndex = useRef(index);
  useEffect(() => {
    indexShared.set(index);
    countShared.set(count);
    const indexChanged = lastIndex.current !== index;
    lastIndex.current = index;
    if (shownIndex.current !== index) {
      jumpTo(index);
    } else if (!indexChanged && shownKey.current !== contentKey) {
      // Same slot, another exercise (Alternatives, Choose another): it arrives in place.
      arrive(1);
    }
    shownKey.current = contentKey;
  }, [arrive, contentKey, count, countShared, index, indexShared, jumpTo]);

  const commit = useCallback((next: number) => {
    shownIndex.current = next;
    if (process.env.EXPO_OS === 'ios') {
      void Haptics.selectionAsync();
    }
    onCommitRef.current(next);
  }, []);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        // Above ResidueSetRow's 10pt so a set's own swipe wins on its row.
        .activeOffsetX([-STAGE_PAN_SLOP, STAGE_PAN_SLOP])
        .failOffsetY([-12, 12])
        .onStart((event) => {
          // Grabbing a settling page takes it from where it is; the slop isn't a jump.
          startPos.set(pos.get());
          startX.set(event.translationX);
          nudge.set(0);
        })
        .onUpdate((event) => {
          const last = countShared.get() - 1;
          const next = startPos.get() - (event.translationX - startX.get()) / width;
          if (next < 0) {
            pos.set(next * STAGE_EDGE_RESISTANCE);
          } else if (next > last) {
            pos.set(last + (next - last) * STAGE_EDGE_RESISTANCE);
          } else {
            pos.set(next);
          }
        })
        .onEnd((event) => {
          const from = indexShared.get();
          const last = countShared.get() - 1;
          // Positive: the pages travelled right, toward the previous exercise.
          const travel = (from - pos.get()) * width + project(event.velocityX);
          let target = from;
          if (travel < -SWIPE_DISTANCE && from < last) {
            target = from + 1;
          } else if (travel > SWIPE_DISTANCE && from > 0) {
            target = from - 1;
          }
          pos.set(
            withSpring(target, {
              ...SPRING.fling,
              velocity: -event.velocityX / width,
              reduceMotion: ReduceMotion.System,
            }),
          );
          if (target !== from) {
            scheduleOnRN(commit, target);
          }
        }),
    [commit, countShared, indexShared, nudge, pos, startPos, startX, width],
  );

  return { pos, nudge, width, gesture, jumpTo };
}

/**
 * One exercise's page. `flow`: the current page sizes its container (the name) and
 * neighbours overlay it; `fill`: every page fills the stage. Neighbours are inert and
 * hidden from VoiceOver, and dim with distance so the page you're on leads.
 */
function PagerPage({
  index,
  current,
  layout,
  pager,
  children,
}: {
  index: number;
  current: boolean;
  layout: 'flow' | 'fill';
  pager: ExercisePager;
  children: ReactNode;
}) {
  const { pos, nudge, width } = pager;
  const style = useAnimatedStyle(() => {
    const offset = index - pos.get();
    return {
      transform: [{ translateX: offset * width + nudge.get() }],
      opacity: interpolate(Math.abs(offset), [0, 1], [1, STAGE_NEIGHBOUR_OPACITY], Extrapolation.CLAMP),
    };
  });
  const place =
    layout === 'fill'
      ? { position: 'absolute' as const, top: 0, right: 0, bottom: 0, left: 0 }
      : current
        ? null
        : { position: 'absolute' as const, top: 0, right: 0, left: 0 };
  return (
    <Animated.View
      pointerEvents={current ? 'auto' : 'none'}
      accessibilityElementsHidden={!current}
      importantForAccessibility={current ? 'auto' : 'no-hide-descendants'}
      style={[place, style]}>
      {children}
    </Animated.View>
  );
}

/** The exercise name: tap for the exercise sheet, hold for the day. Inert on a neighbour page. */
function ExerciseName({
  name,
  onOpen,
}: {
  name: string;
  onOpen?: (sheet: 'day' | 'exercise') => void;
}) {
  const { colors, type } = useTheme();
  return (
    <View style={{ paddingHorizontal: space.gutter, paddingTop: space.related }}>
      <Pressable
        testID={onOpen ? 'log-exercise-name' : undefined}
        disabled={!onOpen}
        onPress={() => onOpen?.('exercise')}
        onLongPress={() => onOpen?.('day')}
        delayLongPress={350}
        accessibilityRole="button"
        accessibilityLabel={name}
        accessibilityHint="Shows exercise details and alternatives."
        accessibilityActions={[{ name: 'activate' }, { name: 'openDay', label: 'Show the day' }]}
        onAccessibilityAction={(event: AccessibilityActionEvent) =>
          onOpen?.(event.nativeEvent.actionName === 'openDay' ? 'day' : 'exercise')
        }
        style={{ alignSelf: 'flex-start' }}>
        {/* Chevron rides inline after the last word (iOS title-menu convention). */}
        <Text style={type.displayCompact} numberOfLines={2} maxFontSizeMultiplier={DISPLAY_TEXT_MAX_SCALE}>
          {name}
          {' '}
          <View style={{ width: 17, height: 17, transform: [{ translateY: -3 }] }}>
            <SymbolView
              name="chevron.down"
              size={iconSize.row}
              weight="semibold"
              tintColor={colors.tertiaryLabel}
              fallback={<ChevronFallback color={colors.tertiaryLabel} />}
            />
          </View>
        </Text>
      </Pressable>
    </View>
  );
}

const STAGE_HEAD = {
  paddingHorizontal: space.gutter,
  paddingTop: space.section,
  gap: space.tight,
  flexShrink: 0,
} as const;
const STAGE_SETS = {
  paddingHorizontal: space.gutter,
  paddingTop: space.gutter,
  paddingBottom: space.gutter,
  gap: space.related,
} as const;

/**
 * `Set 2 of 4`, or `Done` with the green check. The set number rolls (NumberFlow, `change`)
 * when a set is logged or a logged set is picked to edit (trim-ui §8 rule 6). Neighbour pages
 * draw the same component, so a swipe hands over without a swap.
 */
function SetStatus({
  label,
  set,
  complete,
  accessibilityLabel,
  testID,
}: {
  /** What the header says, and reads when there is no set to roll (`Done`). */
  label: string;
  set?: { number: number; of: number };
  complete: boolean;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const { colors, type } = useTheme();
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.tight, minHeight: 28 }}
      accessible
      accessibilityRole="header"
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}>
      {set && !complete ? (
        <StaggerValue
          value={set.number}
          prefix="Set "
          suffix={` of ${set.of}`}
          format={{ useGrouping: false }}
          style={[type.title, { fontVariant: ['tabular-nums'] }]}
        />
      ) : (
        <Text style={[type.title, { fontVariant: ['tabular-nums'] }]}>{label}</Text>
      )}
      {complete ? (
        <SymbolView
          name="checkmark"
          size={iconSize.row}
          weight="bold"
          tintColor={colors.systemGreen}
          fallback={<Text style={[type.button, { color: colors.systemGreen }]}>✓</Text>}
        />
      ) : null}
    </View>
  );
}

function AddSetRow({ onPress }: { onPress?: () => void }) {
  const { colors, type } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      testID={onPress ? 'log-add-set' : undefined}
      accessibilityRole="button"
      accessibilityLabel="Add set"
      accessibilityHint="Adds one more set to this exercise for today only."
      hitSlop={8}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.inline,
        minHeight: 28,
        alignSelf: 'flex-start',
        paddingRight: space.gutter,
        opacity: pressed ? PRESSED_OPACITY : 1,
      })}>
      <SymbolView
        name="plus"
        size={iconSize.row}
        weight="semibold"
        tintColor={colors.tertiaryLabel}
        fallback={
          <Text style={[type.body, { width: iconSize.row, textAlign: 'center', color: colors.tertiaryLabel }]}>
            +
          </Text>
        }
      />
      <Text style={[type.body, { color: colors.tertiaryLabel }]}>Add set</Text>
    </Pressable>
  );
}

/**
 * A neighbour's stage as it will look on arrival (set status, last time or target, logged
 * sets), drawn from its own draft so a swipe never reveals an empty page. Static: no
 * gestures, no edit state. Memoized, so typing in the wells doesn't redraw it.
 */
const StagePreview = memo(function StagePreview({
  draft,
  previousSets,
  targetsFor,
  showTargets,
  offerTarget,
  units,
}: {
  draft: DraftExercise;
  previousSets: readonly LoggedSet[] | null;
  /** Null when neither targets nor the target offer can show. */
  targetsFor: ((exercise: DraftExercise) => (SetTarget | null)[] | null) | null;
  showTargets: boolean;
  offerTarget: boolean;
  units: 'kg' | 'lbs';
}) {
  const { colors, type } = useTheme();
  const minutes = durationIsMinutes(draft.prescription);
  const complete = exerciseIsComplete(draft);
  const setIndex = draft.sets.findIndex((set) => !set.done);
  const targets = useMemo(() => (targetsFor ? targetsFor(draft) : null), [draft, targetsFor]);
  const target = !complete && setIndex >= 0 ? (targets?.[setIndex] ?? null) : null;
  return (
    <View style={{ flex: 1 }}>
      <View style={STAGE_HEAD}>
        <SetStatus
          label={complete ? 'Done' : `Set ${Math.max(0, setIndex) + 1} of ${draft.sets.length}`}
          set={{ number: Math.max(0, setIndex) + 1, of: draft.sets.length }}
          complete={complete}
        />
        <TargetLine
          previousSets={previousSets}
          setIndex={complete ? 'all' : Math.max(0, setIndex)}
          minutes={minutes}
          units={units}
          target={target}
          unlocked={showTargets}
          onUnlock={offerTarget ? NOOP : undefined}
        />
      </View>
      <View style={STAGE_SETS}>
        {draft.sets
          .filter((set) => set.done)
          .map((set) => (
            <View
              key={set.id}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.inline, minHeight: 28 }}>
              <SymbolView
                name="checkmark"
                size={iconSize.row}
                weight="bold"
                tintColor={colors.systemGreen}
                fallback={
                  <Text style={[type.body, { width: iconSize.row, color: colors.systemGreen, textAlign: 'center' }]}>
                    ✓
                  </Text>
                }
              />
              <Text style={[type.body, { fontVariant: ['tabular-nums'] }]} numberOfLines={1}>
                {formatLoggedSetLine(set, { minutes, unit: units })}
              </Text>
            </View>
          ))}
        {complete ? <AddSetRow /> : null}
      </View>
    </View>
  );
});

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
  const { colors, type } = useTheme();
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
        gap: space.related,
        opacity: dimmed ? 0.45 : 1,
        transitionProperty: 'opacity',
        transitionDuration: `${DURATION.exit}ms`,
        transitionTimingFunction: 'ease',
      }}>
      <Text
        importantForAccessibility="no"
        accessibilityElementsHidden
        style={type.caption}>
        {label}
      </Text>
      <Animated.View
        style={{
          borderRadius: radius.md,
          borderCurve: 'continuous',
          overflow: 'hidden',
          backgroundColor: focused ? colors.systemBackground : colors.secondarySystemBackground,
          borderWidth: 2,
          borderColor: focused ? colors.brand : 'transparent',
          transitionProperty: ['backgroundColor', 'borderColor'],
          transitionDuration: `${DURATION.exit}ms`,
          transitionTimingFunction: 'ease',
        }}>
        <TextInput
          ref={inputRef}
          testID={testID}
          selectionColor={colors.brand}
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
            ...type.displayCompact,
            // No lineHeight on a TextInput: iOS applies it to typed text but not the placeholder.
            lineHeight: undefined,
            minHeight: 68,
            textAlign: 'center',
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
              style={[type.caption, { color: colors.secondaryLabel }]}>
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
              style={[type.caption, { color: colors.secondaryLabel }]}>
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
  current,
  complete,
  index,
  count,
  onJump,
  onMove,
}: {
  name: string;
  meta: string;
  /** The exercise on the stage: `Now` in the trailing lane (trim-ui → Separating facts → Lanes). */
  current: boolean;
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
              ...SPRING.fling,
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
          paddingVertical: space.inline,
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
            // The glyph, not its touch target, lines up with the gutter.
            marginLeft: -(TOUCH_TARGET - iconSize.control) / 2,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
          <SymbolView
            name="line.3.horizontal"
            size={iconSize.control}
            tintColor={colors.tertiaryLabel}
            fallback={<Text style={[type.body, { color: colors.tertiaryLabel }]}>≡</Text>}
          />
        </View>
      </GestureDetector>
      <Pressable
        onPress={onJump}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${complete ? 'done' : meta}${current ? ', now' : ''}`}
        accessibilityActions={actions}
        onAccessibilityAction={onAccessibilityAction}
        style={{ flex: 1, paddingLeft: space.pair, flexDirection: 'row', alignItems: 'center', gap: space.inline }}>
        <View style={{ flex: 1, gap: space.pair }}>
          <Text style={type.row}>{name}</Text>
          <Text style={[type.kicker, { fontVariant: ['tabular-nums'] }]}>{meta}</Text>
        </View>
        {complete ? (
          <SymbolView
            name="checkmark"
            size={iconSize.row}
            weight="bold"
            tintColor={colors.systemGreen}
            fallback={<Text style={[type.button, { color: colors.systemGreen }]}>✓</Text>}
          />
        ) : current ? (
          <Text style={type.kicker}>Now</Text>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

type SheetFact = { label: string; value: string; spoken?: string };

function exerciseFacts({
  exercise,
  previous,
  best,
  targets,
  units,
  minutes,
}: {
  exercise: ExercisePrescription;
  previous: PreviousExerciseLog | null;
  best: BestSet | null;
  targets: (SetTarget | null)[] | null;
  units: 'kg' | 'lbs';
  minutes: boolean;
}): SheetFact[] {
  const targetSets = targets?.every((target) => target != null) ? (targets as SetTarget[]) : null;
  return [
    { label: 'Plan', value: formatPlanMetric(exercise) },
    {
      label: 'Last time',
      value: previous
        ? `${formatSetsCompact(previous.sets, { minutes })} ${spokenWhen(formatHistoryWhenInMonth(previous.completedAt))}`
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
            value: `${formatLoggedSetLine(best.set, { minutes, unit: units })} ${spokenWhen(formatShortDate(best.completedAt))}`,
          },
        ]
      : []),
  ];
}

/** The page you moved toward arrives from that side, 8pt (nothing teleports). */
const SHEET_PAGE_FORWARD = FadeInRight.duration(DURATION.enter).easing(EASE_OUT).withInitialValues({
  opacity: 0,
  transform: [{ translateX: ENTER_OFFSET }],
});
const SHEET_PAGE_BACK = FadeInLeft.duration(DURATION.enter).easing(EASE_OUT).withInitialValues({
  opacity: 0,
  transform: [{ translateX: -ENTER_OFFSET }],
});

/** VoiceOver lands on the new page's title when the sheet morphs. */
function useAccessibilityFocus(ref: RefObject<View | null>, enabled: boolean) {
  useEffect(() => {
    // iOS only: react-native-web has no sendAccessibilityEvent, and calling it crashes the log.
    if (!enabled || !ref.current || process.env.EXPO_OS !== 'ios') {
      return;
    }
    AccessibilityInfo.sendAccessibilityEvent(ref.current, 'focus');
  }, [enabled, ref]);
}

/**
 * Exercise fact sheet (no media): plan, last time, best, then Alternatives, or any exercise.
 * An alternative never swaps on tap: its row opens its own facts in place (the sheet morphs,
 * trim-ui §8), and only `Use this exercise` swaps. Back returns to this exercise.
 */
function LogExerciseSheet({
  exercise,
  previous,
  best,
  targets,
  units,
  alternatives,
  previousFor,
  bestFor,
  onSwap,
  onChooseAnother,
}: {
  exercise: ExercisePrescription;
  previous: PreviousExerciseLog | null;
  best: BestSet | null;
  /** Pro only: today's target for every set. */
  targets: (SetTarget | null)[] | null;
  units: 'kg' | 'lbs';
  alternatives: ExercisePrescription[];
  /** Last session and best set of an alternative, by name. */
  previousFor: (name: string) => PreviousExerciseLog | null;
  bestFor: (name: string) => BestSet | null;
  onSwap: (next: ExercisePrescription) => void;
  /** Any exercise from the picker, for when no alternative fits. */
  onChooseAnother: () => void;
}) {
  const reduceMotion = Boolean(useReducedMotion());
  const [preview, setPreview] = useState<ExercisePrescription | null>(null);
  // Null until the first move: the sheet's own entrance is the sheet sliding up, not a page.
  const [moved, setMoved] = useState<'forward' | 'back' | null>(null);
  // The page being left fades out as a layer over the new one (never in the column: kept
  // there, both pages would stack and the sheet would grow to their sum, then shrink back).
  const [leaving, setLeaving] = useState<{ id: number; preview: ExercisePrescription | null } | null>(
    null,
  );
  const leaveCount = useRef(0);
  const entering = moved == null
    ? undefined
    : reduceMotion
      ? FadeIn.duration(DURATION.fade)
      : moved === 'forward'
        ? SHEET_PAGE_FORWARD
        : SHEET_PAGE_BACK;

  const go = (next: ExercisePrescription | null, direction: 'forward' | 'back') => {
    leaveCount.current += 1;
    setLeaving(reduceMotion ? null : { id: leaveCount.current, preview });
    setMoved(direction);
    setPreview(next);
  };
  const open = (item: ExercisePrescription) => go(item, 'forward');
  const back = () => go(null, 'back');

  const page = (shown: ExercisePrescription | null, live: boolean) =>
    shown ? (
      <AlternativePreview
        // Same slot, same sets and reps: the plan line shows what the swap keeps.
        exercise={{
          ...shown,
          sets: exercise.sets,
          reps: exercise.reps,
          repScheme: exercise.repScheme ?? null,
        }}
        previous={previousFor(shown.name)}
        best={bestFor(shown.name)}
        units={units}
        focus={live && moved != null}
        onBack={back}
        onUse={() => onSwap(shown)}
      />
    ) : (
      <ExerciseFactsPage
        exercise={exercise}
        facts={exerciseFacts({
          exercise,
          previous,
          best,
          targets,
          units,
          minutes: durationIsMinutes(exercise),
        })}
        alternatives={alternatives}
        focus={live && moved != null}
        onOpenAlternative={open}
        onChooseAnother={onChooseAnother}
      />
    );

  return (
    // The sheet glides to the new page's height (`morph`).
    <View>
      <Animated.View key={preview ? `preview-${preview.id}` : 'facts'} entering={entering}>
        {page(preview, true)}
      </Animated.View>
      {leaving ? (
        <LeavingPage key={leaving.id} onDone={() => setLeaving(null)}>
          {page(leaving.preview, false)}
        </LeavingPage>
      ) : null}
    </View>
  );
}

/** The page just left: a layer over the new one that fades (`exit`) and is gone. */
function LeavingPage({ children, onDone }: { children: ReactNode; onDone: () => void }) {
  const opacity = useSharedValue(1);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });
  // Once per page: a parent re-render must not restart the fade.
  useEffect(() => {
    const finish = () => onDoneRef.current();
    opacity.set(
      withTiming(0, { duration: DURATION.exit, easing: EASE_OUT }, (finished) => {
        if (finished) {
          scheduleOnRN(finish);
        }
      }),
    );
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ position: 'absolute', top: 0, left: 0, right: 0 }, style]}>
      {children}
    </Animated.View>
  );
}

function ExerciseFactsPage({
  exercise,
  facts,
  alternatives,
  focus,
  onOpenAlternative,
  onChooseAnother,
}: {
  exercise: ExercisePrescription;
  facts: SheetFact[];
  alternatives: ExercisePrescription[];
  focus: boolean;
  onOpenAlternative: (item: ExercisePrescription) => void;
  onChooseAnother: () => void;
}) {
  const { colors, type } = useTheme();
  const detail = exerciseDetail(exercise);
  const titleRef = useRef<View>(null);
  useAccessibilityFocus(titleRef, focus);
  const chevron = (
    <SymbolView
      name="chevron.right"
      tintColor={colors.tertiaryLabel}
      size={iconSize.caption}
      weight="semibold"
      fallback={<Text style={[type.row, { color: colors.tertiaryLabel }]}>›</Text>}
    />
  );

  return (
    <View>
      <View
        ref={titleRef}
        accessible
        accessibilityRole="header"
        accessibilityLabel={detail ? `${exercise.name}, ${detail}` : exercise.name}
        style={{ gap: space.tight, paddingBottom: space.inline }}>
        <Text style={type.title}>{exercise.name}</Text>
        {detail ? <Text style={type.kicker}>{detail}</Text> : null}
      </View>
      <View style={{ paddingBottom: space.inset }}>
        {facts.map((fact) => (
          <FactRow key={fact.label} label={fact.label} value={fact.value} spoken={fact.spoken} />
        ))}
      </View>
      {alternatives.length > 0 ? (
        <>
          <View style={{ paddingTop: space.related, paddingBottom: space.tight }}>
            <Text style={type.kicker}>Alternatives</Text>
          </View>
          {/* A row opens the alternative's facts (chevron: opens in-app detail, §7). */}
          {alternatives.map((item, index) => (
            <PaperRow
              key={item.id}
              title={item.name}
              meta={item.equipments[0] ?? item.targetMuscles[0]}
              testID={`log-alternative-${index}`}
              onPress={() => onOpenAlternative(item)}
              trailing={chevron}
            />
          ))}
        </>
      ) : null}
      <PaperRow
        title="Choose another exercise"
        testID="log-choose-exercise"
        onPress={onChooseAnother}
        trailing={chevron}
      />
    </View>
  );
}

/** One alternative's facts, in the sheet it was opened from: Back, or Use this exercise. */
function AlternativePreview({
  exercise,
  previous,
  best,
  units,
  focus,
  onBack,
  onUse,
}: {
  exercise: ExercisePrescription;
  previous: PreviousExerciseLog | null;
  best: BestSet | null;
  units: 'kg' | 'lbs';
  focus: boolean;
  onBack: () => void;
  onUse: () => void;
}) {
  const { colors, type } = useTheme();
  const detail = exerciseDetail(exercise);
  const titleRef = useRef<View>(null);
  useAccessibilityFocus(titleRef, focus);
  const facts = exerciseFacts({
    exercise,
    previous,
    best,
    targets: null,
    units,
    minutes: durationIsMinutes(exercise),
  });

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingBottom: space.inline }}>
        <Pressable
          onPress={onBack}
          testID="log-alternative-back"
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={4}
          style={({ pressed }) => ({
            width: TOUCH_TARGET,
            height: TOUCH_TARGET,
            // The glyph, not its touch target, lines up with the gutter; the target
            // centers on the title's first line.
            marginLeft: -(TOUCH_TARGET - iconSize.control) / 2,
            marginTop: -space.inline,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? PRESSED_OPACITY : 1,
          })}>
          <SymbolView
            name="chevron.left"
            size={iconSize.control}
            weight="medium"
            tintColor={colors.label}
            fallback={<Text style={[type.title, { color: colors.label }]}>‹</Text>}
          />
        </Pressable>
        <View
          ref={titleRef}
          accessible
          accessibilityRole="header"
          accessibilityLabel={detail ? `${exercise.name}, ${detail}` : exercise.name}
          style={{ flex: 1, gap: space.tight }}>
          <Text style={type.title}>{exercise.name}</Text>
          {detail ? <Text style={type.kicker}>{detail}</Text> : null}
        </View>
      </View>
      <View style={{ paddingBottom: space.inset }}>
        {facts.map((fact) => (
          <FactRow key={fact.label} label={fact.label} value={fact.value} spoken={fact.spoken} />
        ))}
      </View>
      <Button title="Use this exercise" variant="black" testID="log-alternative-use" onPress={onUse} />
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
        gap: space.inset,
        minHeight: 44,
        paddingVertical: space.inline,
      }}>
      <Text style={[type.body, { flexShrink: 0 }]}>{label}</Text>
      <Text
        numberOfLines={1}
        style={[
          type.kicker,
          { flexShrink: 1, textAlign: 'right', color: colors.secondaryLabel, fontVariant: ['tabular-nums'] },
        ]}>
        {value}
      </Text>
    </View>
  );
}
