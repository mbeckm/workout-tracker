import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { catalogKey, exercisePickerMeta, recordExerciseSelection } from '@/catalog';
import {
  bundledExerciseById,
  bundledExerciseInfo,
  kitLabel,
  muscleLabel,
  type ExerciseFigure as FigureKind,
} from '@/catalog/bundled';
import {
  exerciseSheet,
  figureColors,
  fontScaleCap,
  gadgetRadius,
  gadgetType,
  lcd,
  sheetColors,
  sheetGeometry,
  signal,
  spacing,
  tourGeometry,
} from '@/constants/theme';
import { useDevice } from '@/device/device-context';
import { isSheetKind, type SheetParams } from '@/device/device-state';
import { ExerciseArt, exerciseArt } from '@/device/exercise-art';
import { ExerciseFigure } from '@/device/figures';
import { useLogSession } from '@/device/log';
import { useTour } from '@/device/tour/tour-context';
import { TrimSays } from '@/device/tour/trim-says';
import { estimatedOneRM, formatLoadWithUnit, formatLoggedSetLine, roundOneRM } from '@/domain/helpers';
import { liftSeriesFromHistory } from '@/domain/progress';
import type { CustomExerciseDefinition, ExercisePrescription, LoggedSet } from '@/domain/types';
import { DEVICE } from '@/motion';
import { useWorkoutStore } from '@/store/workout-store';

import { ExercisePicker } from './exercise-picker';
import { SectionLabel, SheetCard, SheetHeader, SheetRow, SheetScroll } from './primitives';
import { useSheetChrome } from './sheet-context';

/** What the sheet shows about the lift, from the catalog side map (D5) or the row itself. */
type ExerciseFacts = {
  name: string;
  /** Dot-matrix frames for a bundled lift that has approved art (D5). */
  art?: readonly ImageSourcePropType[];
  figure?: FigureKind;
  howTo?: readonly string[];
  kitLine: string;
  muscles: readonly string[];
};

type Stat = { value: string; label: string };

/**
 * The exercise sheet (M4, SPEC §6 Exercise, screen 06): the movement figure when Trim has
 * one, the name, kit and muscles, HOW TO where it's written, and YOU (estimated max, then
 * best today or last time). No rank (D4). For a lift in the open workout, SWAP FOR under HOW TO:
 * its alternatives, then Choose another (the picker in place, ‹ back). A swap is today only;
 * the receipt asks whether the plan keeps it.
 *
 * Params: `exerciseId` (a session, plan, bundled or custom id), optional `name` as a
 * fallback, and `from`: a sheet kind to go back to with ‹ (Today), else ✕ closes.
 */
export function ExerciseSheet({ params }: { params: SheetParams }) {
  const { close, scrollY, scrollGesture, focusKey } = useSheetChrome();
  const { swapSheet } = useDevice();
  const { plans, customExercises, workoutHistory, units } = useWorkoutStore();
  const log = useLogSession();
  const tour = useTour();
  // The tour's practice lift (decision 85): its swap is the practice's, never the session's.
  const touring = params.tour === '1' && tour.active;
  const insets = useSafeAreaInsets();
  const nameRef = useRef<Text>(null);

  const exerciseId = touring ? tour.current?.id : params.exerciseId;
  const from = isSheetKind(params.from) ? params.from : null;

  const draft = useMemo(
    () => (exerciseId ? log.drafts.find((item) => item.prescription.id === exerciseId) : undefined),
    [exerciseId, log.drafts],
  );

  const row = useMemo(
    () =>
      (touring ? tour.current : null) ??
      draft?.prescription ??
      findRow(exerciseId, plans) ??
      (exerciseId ? bundledExerciseById(exerciseId) : undefined),
    [draft, exerciseId, plans, tour.current, touring],
  );
  const custom = useMemo(
    () => findCustom(exerciseId, row, customExercises),
    [customExercises, exerciseId, row],
  );
  const facts = useMemo(() => exerciseFacts(row, custom, params.name), [custom, params.name, row]);
  const art = facts?.art;

  const stats = useMemo(() => {
    if (!facts) return [];
    const today = (draft?.sets ?? []).filter((set) => set.done);
    return youStats(facts.name, today, workoutHistory, units);
  }, [draft, facts, units, workoutHistory]);

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });

  useEffect(() => {
    // After the slide, so VoiceOver doesn't read the device underneath first.
    const timer = setTimeout(() => {
      if (nameRef.current && typeof AccessibilityInfo.sendAccessibilityEvent === 'function') {
        AccessibilityInfo.sendAccessibilityEvent(nameRef.current, 'focus');
      }
    }, DEVICE.SHEET);
    return () => clearTimeout(timer);
  }, [focusKey]);

  const back = from ? () => swapSheet(from) : close;

  const [picking, setPicking] = useState(false);
  const swappable = touring || (draft != null && !draft.orphan && log.mode != null);
  // While the tour teaches the swap, only the asked-for alternative answers.
  const swapTask = touring && tour.lit === 'swap' ? tour.target : null;
  // Lifts already in today's session aren't alternatives.
  const alternatives = useMemo(() => {
    if (touring) return [...tour.alternatives];
    if (!swappable || !exerciseId) return [];
    const inDay = new Set(log.drafts.map((item) => item.prescription.name.trim().toLowerCase()));
    return log.alternativesFor(exerciseId).filter((item) => !inDay.has(item.name.trim().toLowerCase()));
  }, [exerciseId, log, swappable, tour.alternatives, touring]);
  const swapTo = (exercise: ExercisePrescription) => {
    if (touring) {
      if (swapTask && exercise.id !== swapTask.id) return;
      tour.dispatch({ type: 'swap', alternativeId: exercise.id });
      back();
      return;
    }
    if (exerciseId) log.swapExercise(exerciseId, exercise);
    back();
  };

  if (picking && swappable && draft) {
    return (
      <SwapPicker
        title={`Swap ${draft.prescription.name}`}
        onBack={() => {
          Keyboard.dismiss();
          setPicking(false);
        }}
        onPick={(exercise) => {
          Keyboard.dismiss();
          swapTo(exercise);
        }}
      />
    );
  }

  return (
    <View style={styles.fill}>
      <GestureDetector gesture={scrollGesture}>
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          // At the top a pull moves the sheet, not the content.
          bounces={false}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, sheetGeometry.bottomPad) },
          ]}>
          {art || facts?.figure ? (
            <View style={art ? styles.artFrame : styles.figure}>
              {art ? (
                <View style={styles.artScreen}>
                  <ExerciseArt frames={art} label={facts?.name} />
                </View>
              ) : facts?.figure ? (
                <ExerciseFigure figure={facts.figure} />
              ) : null}
            </View>
          ) : (
            <View style={styles.noFigure} />
          )}

          {facts ? (
            <>
              <View style={styles.titleBlock}>
                <Text
                  ref={nameRef}
                  accessibilityRole="header"
                  maxFontSizeMultiplier={fontScaleCap.title}
                  style={gadgetType.exerciseName}>
                  {facts.name}
                </Text>
                {facts.kitLine ? (
                  <Text maxFontSizeMultiplier={fontScaleCap.text} style={[gadgetType.rowSub, styles.kit]}>
                    {facts.kitLine}
                  </Text>
                ) : null}
              </View>

              {facts.muscles.length > 0 ? (
                <View style={styles.chips} accessibilityLabel={`Muscles: ${facts.muscles.join(', ')}`} accessible>
                  {facts.muscles.map((muscle, index) => (
                    <View key={muscle} style={[styles.chip, index === 0 && styles.chipPrimary]}>
                      <Text
                        maxFontSizeMultiplier={fontScaleCap.title}
                        style={[gadgetType.chip, index === 0 ? styles.chipPrimaryText : styles.chipText]}>
                        {muscle}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {facts.howTo ? (
                <>
                  <SectionLabel>How to</SectionLabel>
                  <SheetCard>
                    {facts.howTo.map((step, index) => (
                      <View
                        key={index}
                        style={styles.step}
                        accessible
                        accessibilityLabel={`Step ${index + 1}. ${step}`}>
                        <Text maxFontSizeMultiplier={fontScaleCap.text} style={[gadgetType.stepNumber, styles.stepNumber]}>
                          {index + 1}
                        </Text>
                        <Text maxFontSizeMultiplier={fontScaleCap.text} style={[gadgetType.step, styles.stepText]}>
                          {step}
                        </Text>
                      </View>
                    ))}
                  </SheetCard>
                </>
              ) : null}

              {swappable ? (
                <>
                  {swapTask ? <TrimSays>{`Swap it for ${swapTask.name}.`}</TrimSays> : null}
                  <SectionLabel>Swap for</SectionLabel>
                  {alternatives.length > 0 ? (
                    <SheetCard>
                      {alternatives.map((exercise) => (
                        <View key={exercise.id} style={swapTask?.id === exercise.id ? styles.swapTarget : undefined}>
                          <SheetRow
                            size="compact"
                            title={exercise.name}
                            sub={exercisePickerMeta(exercise)}
                            trailing={swapTask?.id === exercise.id ? 'Swap' : undefined}
                            onPress={() => {
                              if (!touring) void recordExerciseSelection(exercise);
                              swapTo(exercise);
                            }}
                          />
                        </View>
                      ))}
                    </SheetCard>
                  ) : null}
                  {touring ? null : (
                    <SheetCard>
                      <SheetRow size="compact" title="Choose another" onPress={() => setPicking(true)} />
                    </SheetCard>
                  )}
                </>
              ) : null}

              {stats.length > 0 ? (
                <>
                  <SectionLabel>You</SectionLabel>
                  <SheetCard>
                    <View style={styles.stats}>
                      {stats.map((stat) => (
                        <View
                          key={stat.label}
                          style={styles.stat}
                          accessible
                          accessibilityLabel={`${stat.label}, ${stat.value}`}>
                          <Text maxFontSizeMultiplier={fontScaleCap.title} style={[gadgetType.statValue, styles.center]}>
                            {stat.value}
                          </Text>
                          <Text maxFontSizeMultiplier={fontScaleCap.title} style={[gadgetType.statLabel, styles.center]}>
                            {stat.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </SheetCard>
                </>
              ) : null}
            </>
          ) : null}
        </Animated.ScrollView>
      </GestureDetector>

      <Pressable
        onPress={back}
        accessibilityRole="button"
        accessibilityLabel={from ? 'Back' : 'Close'}
        hitSlop={sheetGeometry.controlTop / 2}
        style={({ pressed }) => [styles.control, pressed && styles.controlPressed]}>
        <Text maxFontSizeMultiplier={fontScaleCap.display} style={gadgetType.control}>
          {from ? '‹' : '✕'}
        </Text>
      </Pressable>
    </View>
  );
}

/** Choose another (in place): the whole catalog through the picker in replace mode. */
function SwapPicker({
  title,
  onBack,
  onPick,
}: {
  title: string;
  onBack: () => void;
  onPick: (exercise: ExercisePrescription) => void;
}) {
  const log = useLogSession();
  const takenKeys = useMemo(() => new Set(log.drafts.map((item) => catalogKey(item.prescription))), [log.drafts]);
  return (
    <SheetScroll header={<SheetHeader title={title} left={{ kind: 'back', onPress: onBack }} />}>
      <ExercisePicker mode="replace" onPick={onPick} takenKeys={takenKeys} />
    </SheetScroll>
  );
}

/* ----------------------------------------------------------------------------------------- *
 * Facts
 * ----------------------------------------------------------------------------------------- */

function findRow(
  id: string | undefined,
  plans: readonly { days: readonly { exercises: readonly ExercisePrescription[] }[] }[],
): ExercisePrescription | undefined {
  if (!id) return undefined;
  for (const plan of plans) {
    for (const day of plan.days) {
      const match = day.exercises.find((exercise) => exercise.id === id);
      if (match) return match;
    }
  }
  return undefined;
}

function findCustom(
  id: string | undefined,
  row: ExercisePrescription | undefined,
  customs: readonly CustomExerciseDefinition[],
): CustomExerciseDefinition | undefined {
  const customId = row?.customExerciseID ?? (id?.startsWith('custom-') ? id.slice('custom-'.length) : id);
  return customId ? customs.find((item) => item.id === customId) : undefined;
}

function kitLine(kit: string, muscles: readonly string[]): string {
  const muscle = muscles[0]?.toLowerCase();
  return [kit, muscle].filter((part) => part).join(', ');
}

/**
 * The catalog's side map for bundled lifts (art or figure, how-to, muscles); a custom exercise
 * gets its own kit and muscle and never art or a figure (D5).
 */
function exerciseFacts(
  row: ExercisePrescription | undefined,
  custom: CustomExerciseDefinition | undefined,
  fallbackName: string | undefined,
): ExerciseFacts | null {
  if (custom) {
    const muscle = muscleLabel(custom.muscle);
    const muscles = muscle ? [muscle] : [];
    return { name: custom.name, kitLine: kitLine(kitLabel(custom.equipment), muscles), muscles };
  }
  const name = row?.name ?? fallbackName;
  if (!name) return null;
  const info = row?.customExerciseID ? null : bundledExerciseInfo(name);
  if (info) {
    const art = exerciseArt(row?.id, name);
    return {
      name,
      ...(art ? { art } : null),
      figure: info.figure,
      howTo: info.howTo,
      kitLine: kitLine(info.kit, info.muscles),
      muscles: info.muscles,
    };
  }
  const muscle = muscleLabel(row?.targetMuscles[0]);
  const muscles = muscle ? [muscle] : [];
  return { name, kitLine: kitLine(kitLabel(row?.equipments[0]), muscles), muscles };
}

/** The best set: heaviest load, then most reps, then the longest hold. */
function bestSet(sets: readonly LoggedSet[]): LoggedSet | null {
  let best: LoggedSet | null = null;
  for (const set of sets) {
    if (!best) {
      best = set;
      continue;
    }
    const load = set.weight ?? set.counterweight ?? 0;
    const bestLoad = best.weight ?? best.counterweight ?? 0;
    const reps = set.reps ?? 0;
    const bestReps = best.reps ?? 0;
    if (
      load > bestLoad ||
      (load === bestLoad && reps > bestReps) ||
      (load === bestLoad && reps === bestReps && (set.durationSeconds ?? 0) > (best.durationSeconds ?? 0))
    ) {
      best = set;
    }
  }
  return best;
}

/**
 * YOU (D4, no rank): the estimated max from history, raised by today's sets while logging,
 * then the best set today or, before the first set, the best set last time.
 */
function youStats(
  name: string,
  today: readonly LoggedSet[],
  history: Parameters<typeof liftSeriesFromHistory>[1],
  units: 'kg' | 'lbs',
): Stat[] {
  const stats: Stat[] = [];
  const series = liftSeriesFromHistory(name, history);
  const fromHistory = series.length > 0 ? series[series.length - 1]!.oneRM : null;
  const fromToday = today.reduce<number | null>((top, set) => {
    const value = estimatedOneRM(set.weight, set.reps);
    return value != null && (top == null || value > top) ? value : top;
  }, null);
  const estimate = Math.max(fromHistory ?? 0, fromToday ?? 0);
  if (estimate > 0) {
    stats.push({ value: formatLoadWithUnit(roundOneRM(estimate), units), label: 'Estimated max' });
  }

  const todayBest = bestSet(today);
  if (todayBest) {
    stats.push({ value: formatLoggedSetLine(todayBest, { unit: units }), label: 'Best today' });
    return stats;
  }
  const key = name.trim().toLowerCase();
  const last = history.find((workout) =>
    workout.exercises.some((exercise) => exercise.exerciseName.trim().toLowerCase() === key && exercise.sets.length > 0),
  );
  const lastSets = last?.exercises.find((exercise) => exercise.exerciseName.trim().toLowerCase() === key)?.sets ?? [];
  const lastBest = bestSet(lastSets);
  if (lastBest) {
    stats.push({ value: formatLoggedSetLine(lastBest, { unit: units }), label: 'Last time' });
  }
  return stats;
}

const styles = StyleSheet.create({
  /** The alternative the tour asks for: the amber focus frame inside the card (decision 85). */
  swapTarget: {
    borderWidth: tourGeometry.focusStroke,
    borderColor: signal.orange,
    borderRadius: gadgetRadius.card,
    borderCurve: 'continuous',
  },
  fill: { flex: 1 },
  content: { paddingHorizontal: sheetGeometry.sidePad },
  figure: {
    height: exerciseSheet.figureHeight,
    marginTop: exerciseSheet.figureTop,
    borderRadius: gadgetRadius.figure,
    borderCurve: 'continuous',
    overflow: 'hidden',
    experimental_backgroundImage: `radial-gradient(ellipse at 50% 60%, ${figureColors.groundHi}, ${figureColors.groundLo})`,
  },
  // Dot-matrix art sits in a small screen: a card-coloured bezel round an lcd glass (r28 − 8 = r20).
  artFrame: {
    height: exerciseSheet.figureHeight,
    marginTop: exerciseSheet.figureTop,
    padding: spacing.sm,
    borderRadius: gadgetRadius.figure,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: sheetColors.card,
  },
  artScreen: {
    flex: 1,
    borderRadius: gadgetRadius.lcdFrame,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: lcd.lcd,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: lcd.lcdShade,
  },
  // Without a figure the name starts under the floating control, like under a header.
  noFigure: { height: sheetGeometry.headerHeight },
  titleBlock: { paddingTop: exerciseSheet.nameTop, paddingHorizontal: exerciseSheet.namePadX },
  kit: { marginTop: exerciseSheet.kitTop },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: exerciseSheet.chipGap,
    paddingTop: exerciseSheet.chipsTop,
    paddingHorizontal: exerciseSheet.namePadX,
  },
  chip: {
    minHeight: exerciseSheet.chipHeight,
    paddingHorizontal: exerciseSheet.chipPadX,
    borderRadius: gadgetRadius.muscleChip,
    borderCurve: 'continuous',
    backgroundColor: sheetColors.pillDark,
    justifyContent: 'center',
  },
  chipPrimary: { backgroundColor: signal.orange },
  chipText: { color: sheetColors.inkSoft },
  chipPrimaryText: { color: sheetColors.onOrange },
  step: {
    flexDirection: 'row',
    gap: exerciseSheet.stepGap,
    paddingHorizontal: exerciseSheet.stepPadX,
    paddingVertical: exerciseSheet.stepPadY,
  },
  stepNumber: { minWidth: exerciseSheet.stepNumberWidth },
  stepText: { flex: 1 },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: exerciseSheet.statPadY,
    paddingHorizontal: exerciseSheet.statPadX,
  },
  stat: { flexShrink: 1, alignItems: 'center' },
  center: { textAlign: 'center' },
  control: {
    position: 'absolute',
    top: exerciseSheet.controlY,
    left: exerciseSheet.controlX,
    height: sheetGeometry.control,
    minWidth: sheetGeometry.control,
    paddingHorizontal: sheetGeometry.controlPadX,
    borderRadius: gadgetRadius.control,
    borderCurve: 'continuous',
    backgroundColor: figureColors.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlPressed: { backgroundColor: sheetColors.cardRaised },
});
