import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  AppState,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
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
import { PaperRow } from '@/components/paper';
import { ResidueSetRow } from '@/components/residue-set-row';
import { exerciseStillMediaURL, offlineCatalogExercises } from '@/catalog';
import { radius } from '@/constants/theme';
import {
  clonePrescription,
  durationIsMinutes,
  emptyLoggedSet,
  formatLoggedSetLine,
  parsePositiveNumber,
  repsForSet,
  setCount,
  usesDuration,
  usesReps,
  usesWeight,
  withDay,
} from '@/domain/helpers';
import { restSecondsForExercise } from '@/domain/rest';
import { EASE_OUT } from '@/motion';
import {
  newId,
  type ExercisePrescription,
  type LoggedExercise,
  type LoggedSet,
} from '@/domain/types';
import { endWorkoutLiveActivity, loadWorkoutFocus, syncWorkoutLiveActivity } from '@/live-activity/controller';
import type { WorkoutRestWindow } from '@/live-activity/types';
import { parseWorkoutLogUrl } from '@/live-activity/url';
import { upcomingExerciseIndex } from '@/live-activity/upcoming';
import { useWorkoutStore } from '@/store/workout-store';
import { useTheme } from '@/theme/theme-context';

type DraftSet = LoggedSet & { done: boolean };

type DraftExercise = {
  prescription: ExercisePrescription;
  sets: DraftSet[];
};

type WellFocus = 'weight' | 'reps' | 'duration' | null;

const WEIGHT_STEP = { kg: 2.5, lbs: 5 } as const;
const SWIPE_DISTANCE = 56;
const CHIP_PAD_X = 12;
const REST_IN = FadeIn.duration(160).easing(EASE_OUT);
const REST_OUT = FadeOut.duration(120).easing(EASE_OUT);

function project(velocity: number, decelerationRate = 0.998) {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function buildDrafts(
  exercises: ExercisePrescription[],
  previousSetsForExercise: (name: string) => LoggedSet[],
): DraftExercise[] {
  return exercises.map((exercise) => {
    const history = previousSetsForExercise(exercise.name);
    const lastLogged = history[history.length - 1] ?? null;
    return {
      prescription: exercise,
      sets: Array.from({ length: setCount(exercise) }, (_, index) => {
        const previous = history[index] ?? lastLogged;
        return {
          ...emptyLoggedSet(index + 1, previous),
          reps: previous?.reps ?? repsForSet(exercise, index),
          durationSeconds: previous?.durationSeconds ?? exercise.durationSeconds ?? null,
          done: false,
        };
      }),
    };
  });
}

function formatSetFact(
  set: Pick<LoggedSet, 'weight' | 'reps' | 'counterweight' | 'durationSeconds'>,
  units: 'kg' | 'lbs',
  minutes: boolean,
): string {
  const load = set.weight ?? set.counterweight;
  if (load != null && set.reps != null) {
    const loadText = Number.isInteger(load) ? String(load) : String(load);
    return `${loadText} ${units} × ${set.reps}`;
  }
  return formatLoggedSetLine(set, { minutes });
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

function formatRestClock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
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
    customExercises,
    previousSetsForExercise,
    previousLogForExercise,
    completeWorkout,
    updatePlan,
    isHydrated,
  } = useWorkoutStore();
  const plan = plans.find((item) => item.id === planId);
  const day = plan?.days.find((item) => item.id === dayId);
  const startedAt = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [rest, setRest] = useState<WorkoutRestWindow | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [drafts, setDrafts] = useState<DraftExercise[]>(() =>
    day ? buildDrafts(day.exercises, previousSetsForExercise) : [],
  );
  const draftsRef = useRef(drafts);
  const [wellFocus, setWellFocus] = useState<WellFocus>(null);
  const [loggedPulseId, setLoggedPulseId] = useState<string | null>(null);
  const [residueResetKeys, setResidueResetKeys] = useState<Record<string, number>>({});
  const [sheet, setSheet] = useState<'day' | 'exercise' | null>(null);
  const seededFromHistory = useRef(false);
  const keyboardOpen = useKeyboardState((state) => state.isVisible);
  const openSheet = (next: 'day' | 'exercise') => {
    Keyboard.dismiss();
    setSheet(next);
  };

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  useEffect(() => {
    if (!keyboardOpen) {
      setWellFocus(null);
    }
  }, [keyboardOpen]);

  const startRest = (seconds: number) => {
    const startedAtMs = Date.now();
    setRest({ startedAtMs, endsAtMs: startedAtMs + seconds * 1000 });
  };

  useEffect(() => {
    if (!day?.exercises.length || !isHydrated || seededFromHistory.current) {
      return;
    }
    seededFromHistory.current = true;
    setDrafts(buildDrafts(day.exercises, previousSetsForExercise));
  }, [day, isHydrated, previousSetsForExercise]);

  useEffect(() => {
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (rest == null) {
      return;
    }
    const tick = setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      if (now >= rest.endsAtMs) {
        setRest(null);
      }
    }, 250);
    return () => clearInterval(tick);
  }, [rest]);

  const restSeconds = rest == null ? null : Math.max(0, Math.ceil((rest.endsAtMs - nowMs) / 1000));
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

  const activeSetIndex = useMemo(() => {
    if (!current) {
      return 0;
    }
    const index = current.sets.findIndex((set) => !set.done);
    return index === -1 ? current.sets.length : index;
  }, [current]);

  const loggingSet = current?.sets[Math.min(activeSetIndex, Math.max(0, (current?.sets.length ?? 1) - 1))];
  const exerciseComplete = Boolean(current && current.sets.length > 0 && current.sets.every((set) => set.done));
  const showWeight = current ? usesWeight(current.prescription.trackingMode) : false;
  const showReps = current ? usesReps(current.prescription.trackingMode) : false;
  const showDuration = current ? usesDuration(current.prescription.trackingMode) && !showReps : false;
  const minutes = current ? durationIsMinutes(current.prescription) : false;

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

  const completeSet = () => {
    if (!current || exerciseComplete) {
      return;
    }
    const setIndex = activeSetIndex;
    const target = current.sets[setIndex];
    if (!target || target.done) {
      return;
    }

    setDrafts((items) =>
      items.map((exercise, index) => {
        if (index !== exerciseIndex) {
          return exercise;
        }
        return {
          ...exercise,
          sets: exercise.sets.map((set, inner) => {
            if (inner === setIndex) {
              return { ...set, done: true };
            }
            if (inner > setIndex && !set.done) {
              return {
                ...set,
                weight: target.weight ?? set.weight,
                reps: target.reps ?? set.reps,
                counterweight: target.counterweight ?? set.counterweight,
                durationSeconds: target.durationSeconds ?? set.durationSeconds,
              };
            }
            return set;
          }),
        };
      }),
    );

    setLoggedPulseId(target.id);
    setWellFocus(null);
    Keyboard.dismiss();
    if (process.env.EXPO_OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    startRest(restSecondsForExercise(current.prescription));
    const isLastSet = setIndex === current.sets.length - 1;
    if (isLastSet && exerciseIndex < drafts.length - 1) {
      setTimeout(() => setExerciseIndex((value) => value + 1), 220);
    }
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
    void endWorkoutLiveActivity();
    leaveWorkout();
  };

  const confirmDiscard = () => {
    Alert.alert('Discard workout?', 'Your logged sets will not be saved.', [
      { text: 'Keep logging', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: discardWithoutSaving },
    ]);
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
    setRest(null);
    setLoggedPulseId(null);
  };

  const confirmDeleteSet = (set: DraftSet) => {
    const line = formatSetFact(set, units, minutes);
    Alert.alert('Delete set?', `${line} will be removed from this exercise.`, [
      {
        text: 'Cancel',
        style: 'cancel',
        onPress: () => {
          setResidueResetKeys((keys) => ({
            ...keys,
            [set.id]: (keys[set.id] ?? 0) + 1,
          }));
        },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => removeLoggedSet(set.id),
      },
    ]);
  };

  const finish = () => {
    if (!day || !plan) {
      leaveWorkout();
      return;
    }
    const exercises: LoggedExercise[] = drafts
      .map((exercise) => ({
        id: newId(),
        exerciseName: exercise.prescription.name,
        sets: exercise.sets.filter((set) => set.done).map(({ done: _done, ...set }) => set),
        // History never stores media URLs; media resolves from catalog identity.
        thumbnailURL: null,
        imageURL: null,
        imageURLs: {},
      }))
      .filter((exercise) => exercise.sets.length > 0);

    if (exercises.length === 0) {
      Alert.alert('No sets logged', 'Log at least one set to save this workout.', [
        { text: 'Keep logging', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: discardWithoutSaving },
      ]);
      return;
    }

    const workout = completeWorkout({
      title: day.title,
      exercises,
      durationMinutes: Math.max(1, Math.round(elapsed / 60)),
      startedAt: new Date(startedAt.current).toISOString(),
      planId: plan.id,
      dayId: day.id,
    });
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
        exercises: nextDrafts.map((item) => item.prescription),
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
    setDrafts((items) =>
      items.map((exercise, index) => {
        if (index !== exerciseIndex) {
          return exercise;
        }
        return {
          prescription: swapped,
          sets: hadLogs ? exercise.sets : buildDrafts([swapped], previousSetsForExercise)[0]?.sets ?? exercise.sets,
        };
      }),
    );
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
  const lastPrevious = previous?.sets[previous.sets.length - 1];
  const lastTimeLine = lastPrevious
    ? `Last time ${formatSetFact(lastPrevious, units, minutes)}`
    : null;
  const setStatus =
    current == null
      ? 'Set'
      : `Set ${Math.min(activeSetIndex + 1, current.sets.length)} of ${current.sets.length}`;

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
            style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={[type.body, { color: colors.tertiaryLabel }]}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={finish}
            accessibilityRole="button"
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
                  accessibilityHint="Opens exercise details. Long press to reorder the day.">
                  <Text style={type.largeTitle} numberOfLines={2}>
                    {current.prescription.name}
                  </Text>
                </Pressable>
              </View>
              <View style={{ flexShrink: 0, paddingTop: 20 }}>
                <DayStrip
                  drafts={drafts}
                  selectedIndex={exerciseIndex}
                  onSelect={setExerciseIndex}
                  onOpenDay={() => openSheet('day')}
                />
              </View>

              <ExerciseStage
                exerciseKey={current.prescription.id}
                canGoPrev={exerciseIndex > 0}
                canGoNext={exerciseIndex < drafts.length - 1}
                onPrev={() => setExerciseIndex((value) => Math.max(0, value - 1))}
                onNext={() =>
                  setExerciseIndex((value) => Math.min(drafts.length - 1, value + 1))
                }
                reduceMotion={Boolean(reduceMotion)}>
                <View style={{ paddingHorizontal: 24, paddingTop: 32, gap: 4, flexShrink: 0 }}>
                  <Text
                    style={[type.title, { fontVariant: ['tabular-nums'] }]}
                    accessibilityRole="header">
                    {setStatus}
                  </Text>
                  {lastTimeLine ? (
                    <Text
                      style={[
                        type.kicker,
                        {
                          fontWeight: '400',
                          color: colors.tertiaryLabel,
                          fontVariant: ['tabular-nums'],
                        },
                      ]}>
                      {lastTimeLine}
                    </Text>
                  ) : null}
                </View>

                <View
                  style={{
                    flex: 1,
                    minHeight: 0,
                    paddingHorizontal: 24,
                    paddingTop: 24,
                    gap: 10,
                    overflow: 'visible',
                  }}>
                  {residueSets.map((set) => (
                    <ResidueSetRow
                      key={set.id}
                      label={formatSetFact(set, units, minutes)}
                      reduceMotion={Boolean(reduceMotion)}
                      resetKey={residueResetKeys[set.id] ?? 0}
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
                      onRequestDelete={() => confirmDeleteSet(set)}
                    />
                  ))}
                </View>
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
          {restSeconds != null ? (
            <Animated.View entering={REST_IN} exiting={REST_OUT}>
              <Pressable onPress={() => setRest(null)} accessibilityRole="button" accessibilityLabel="Skip rest">
                <Text style={type.kicker}>Rest</Text>
                <Text style={[type.residue, { fontVariant: ['tabular-nums'] }]}>
                  {formatRestClock(restSeconds)}
                </Text>
              </Pressable>
            </Animated.View>
          ) : null}

          {loggingSet ? (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {showWeight ? (
                <LogWell
                  label={units.toUpperCase()}
                  testID="log-well-weight"
                  value={loggingSet.weight == null ? '' : String(loggingSet.weight)}
                  onChange={(value) =>
                    updateSet(Math.min(activeSetIndex, current!.sets.length - 1), {
                      weight: parsePositiveNumber(value),
                    })
                  }
                  step={WEIGHT_STEP[units]}
                  keyboard="decimal-pad"
                  focused={wellFocus === 'weight'}
                  dimmed={wellFocus != null && wellFocus !== 'weight'}
                  onFocus={() => setWellFocus('weight')}
                />
              ) : null}
              {showReps ? (
                <LogWell
                  label="REPS"
                  testID="log-well-reps"
                  value={loggingSet.reps == null ? '' : String(loggingSet.reps)}
                  onChange={(value) =>
                    updateSet(Math.min(activeSetIndex, current!.sets.length - 1), {
                      reps: parsePositiveNumber(value),
                    })
                  }
                  step={1}
                  keyboard="number-pad"
                  focused={wellFocus === 'reps'}
                  dimmed={wellFocus != null && wellFocus !== 'reps'}
                  onFocus={() => setWellFocus('reps')}
                />
              ) : null}
              {showDuration ? (
                <LogWell
                  label={minutes ? 'MIN' : 'SEC'}
                  value={
                    loggingSet.durationSeconds == null
                      ? ''
                      : String(minutes ? Math.round(loggingSet.durationSeconds / 60) : loggingSet.durationSeconds)
                  }
                  onChange={(value) => {
                    const parsed = parsePositiveNumber(value);
                    updateSet(Math.min(activeSetIndex, current!.sets.length - 1), {
                      durationSeconds: parsed == null ? null : minutes ? Math.round(parsed * 60) : parsed,
                    });
                  }}
                  step={1}
                  keyboard="number-pad"
                  focused={wellFocus === 'duration'}
                  dimmed={wellFocus != null && wellFocus !== 'duration'}
                  onFocus={() => setWellFocus('duration')}
                />
              ) : null}
            </View>
          ) : null}

          <Button
            title="Log set"
            variant="green"
            testID="log-set"
            disabled={exerciseComplete}
            onPress={completeSet}
          />
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
          {drafts.map((exercise, index) => (
            <DaySheetRow
              key={exercise.prescription.id}
              name={exercise.prescription.name}
              meta={index === exerciseIndex ? 'Now' : `${exercise.sets.length} sets`}
              index={index}
              onJump={() => {
                setExerciseIndex(index);
                setSheet(null);
              }}
              onMove={(from, to) => persistOrder(moveItem(drafts, from, to))}
            />
          ))}
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
        const complete = exercise.sets.length > 0 && exercise.sets.every((set) => set.done);
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
            accessibilityLabel={exercise.prescription.name}
            accessibilityHint={selected ? 'Opens the day so you can reorder' : 'Jump to this exercise'}
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
                  ? colors.onTint
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
                tintColor={selected ? colors.onTint : colors.systemGreen}
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
  value,
  onChange,
  step,
  keyboard,
  focused,
  dimmed,
  onFocus,
  testID,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  step: number;
  keyboard: 'decimal-pad' | 'number-pad';
  focused: boolean;
  dimmed: boolean;
  onFocus: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
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
          transitionProperty: 'backgroundColor, borderColor',
          transitionDuration: '150ms',
          transitionTimingFunction: 'ease',
        }}>
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChange}
          onFocus={onFocus}
          keyboardType={keyboard}
          placeholder="—"
          placeholderTextColor={colors.tertiaryLabel}
          underlineColorAndroid="transparent"
          style={{
            height: 68,
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
            height: 44,
            borderTopWidth: 0.5,
            borderTopColor: colors.systemGray4,
          }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Decrease ${label}`}
            onPressIn={() => onChange(nudgeString(value, -step))}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 20, lineHeight: 24, color: colors.secondaryLabel }}>−</Text>
          </Pressable>
          <View style={{ width: 0.5, backgroundColor: colors.systemGray4 }} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Increase ${label}`}
            onPressIn={() => onChange(nudgeString(value, step))}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 20, lineHeight: 24, color: colors.secondaryLabel }}>+</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function DaySheetRow({
  name,
  meta,
  index,
  onJump,
  onMove,
}: {
  name: string;
  meta: string;
  index: number;
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
          style={{
            width: 24,
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
          <SymbolView name="line.3.horizontal" size={16} tintColor={colors.separator} />
        </View>
      </GestureDetector>
      <Pressable onPress={onJump} style={{ flex: 1, paddingLeft: 12, gap: 2 }}>
        <Text style={type.row}>{name}</Text>
        <Text style={type.kicker}>{meta}</Text>
      </Pressable>
    </Animated.View>
  );
}

function LogExerciseSheet({
  exercise,
  alternatives,
  onSwap,
}: {
  exercise: ExercisePrescription;
  alternatives: ExercisePrescription[];
  onSwap: (next: ExercisePrescription) => void;
}) {
  const { type } = useTheme();
  const muscle = exercise.targetMuscles[0];
  const equipment = exercise.equipments[0];
  const detail = [muscle, equipment].filter(Boolean).join(' · ');

  return (
    <View>
      <View style={{ gap: 6, paddingBottom: 16 }}>
        <Text style={type.title}>{exercise.name}</Text>
        {detail ? <Text style={type.kicker}>{detail}</Text> : null}
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
