import { SymbolView } from 'expo-symbols';
import { Stack, useIsFocused, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  interpolateColor,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Button } from '@/components/button';
import { HomeDayRow } from '@/components/home-day-row';
import { StaggerValue } from '@/components/stagger-value';
import { iconSize, PRESSED_OPACITY, radius, space, TOUCH_TARGET } from '@/constants/theme';
import { DURATION, EASE_IN_OUT, EASE_OUT, SPRING } from '@/motion';
import { useTheme } from '@/theme/theme-context';
import {
  estimateDayMinutes,
  formatClockTime,
  formatDoneLabel,
  formatEstimateMinutes,
  lastDoneAt,
  spokenEstimateMinutes,
} from '@/domain/day-facts';
import { emptyPlan, formatPlanMetricWithLoad } from '@/domain/helpers';
import { completedPlanDayIdsSince, startOfLocalWeek, trainableDays } from '@/domain/plan-loop';
import type { ExercisePrescription, WorkoutDay, WorkoutPlan } from '@/domain/types';
import { useStartDay } from '@/navigation/start-day';
import { useWorkoutStore } from '@/store/workout-store';

/**
 * Rows shown before the list folds into a peer `n more exercises` row (trim-ui → Structure).
 * A list only folds when it hides at least two rows: `1 more exercise` costs as much room as
 * the row it hides.
 */
const COLLAPSED_ROWS = 4;

/** Expand / collapse in place (trim-ui → Motion → approved list): layout `enter`, ease-in-out. */
const EXPAND_LAYOUT = LinearTransition.duration(DURATION.enter).easing(EASE_IN_OUT);
/** Rows fade in and out; under Reduce Motion the fade stays and the movement goes. */
const ROW_ENTER = FadeIn.duration(DURATION.enter).easing(EASE_IN_OUT).reduceMotion(ReduceMotion.Never);
const ROW_EXIT = FadeOut.duration(DURATION.exit).easing(EASE_OUT).reduceMotion(ReduceMotion.Never);

/**
 * Home (trim-ui → Per screen → Home). The day name is the native large title; under it one
 * fact, the estimated duration. Then the day's exercises as one object surface with Start
 * right under it, the week, and the plan's other days.
 */
export function WorkoutTab() {
  const { colors, type } = useTheme();
  const router = useRouter();
  const { activePlan, nextDayIndex, savePlan, workoutHistory, activeSession } = useWorkoutStore();
  const startDay = useStartDay();

  const createPlan = () => {
    const plan = emptyPlan();
    savePlan(plan, { activate: true });
    router.push(`/plan/${plan.id}?new=1`);
  };

  const openPicker = (plan: WorkoutPlan, day: WorkoutDay) => {
    router.push(
      `/exercises?planId=${plan.id}&dayId=${day.id}&dayTitle=${encodeURIComponent(day.title)}`,
    );
  };

  const openPreview = (plan: WorkoutPlan, day: WorkoutDay) => {
    router.push({ pathname: '/day-preview', params: { planId: plan.id, dayId: day.id } });
  };

  // H-8: a workout in progress on this plan takes the stage until it's finished.
  const session = activePlan && activeSession?.planId === activePlan.id ? activeSession : null;
  const sessionDay = session ? activePlan?.days.find((item) => item.id === session.dayId) : undefined;
  // A stale index (a day was just removed) falls back to the first day instead of a blank Home.
  const day = sessionDay ?? activePlan?.days[nextDayIndex] ?? activePlan?.days[0];
  const resuming = session != null && sessionDay != null;
  const hasExercises = day != null && day.exercises.length > 0;

  const weekStart = startOfLocalWeek();
  const doneIds = completedPlanDayIdsSince(activePlan, workoutHistory, weekStart);
  const total = activePlan ? trainableDays(activePlan).length : 0;
  const done = Math.min(doneIds.length, total);

  // One fact under the title (trim-ui → Copy → Separating facts): how long the day takes, or,
  // mid-workout, when it started.
  let fact: { text: string; spoken?: string } | null = null;
  if (activePlan && day) {
    if (resuming && session) {
      fact = { text: `Started ${formatClockTime(session.startedAt)}` };
    } else if (hasExercises) {
      const minutes = estimateDayMinutes(activePlan, day, workoutHistory);
      fact =
        minutes != null
          ? { text: formatEstimateMinutes(minutes), spoken: spokenEstimateMinutes(minutes) }
          : null;
    } else {
      fact = { text: 'No exercises yet' };
    }
  }

  // H-1: every other day you can train, so any day of the plan can be started from Home.
  const otherDays =
    activePlan && day
      ? activePlan.days.filter((item) => item.id !== day.id && item.exercises.length > 0)
      : [];
  const onlyDayDoneAt =
    activePlan && total <= 1 && day ? lastDoneAt(activePlan, day.id, workoutHistory) : null;

  // The native large title: the day's name, or the empty state's fact (trim-ui → Components).
  const title = day?.title ?? (activePlan ? 'Workout' : 'No plan yet');

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.systemBackground }}
        // Insets for the large title bar and the tab bar come from the system.
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingHorizontal: space.gutter, paddingBottom: space.pause }}
        testID="home-scroll">
        {activePlan ? (
          <View testID="home-next-day">
            {fact ? (
              <Text
                style={[type.caption, { fontVariant: ['tabular-nums'] }]}
                accessibilityLabel={fact.spoken}
                testID="home-day-meta">
                {fact.text}
              </Text>
            ) : null}

            {day && hasExercises ? (
              <View style={{ paddingTop: space.gutter }}>
                <ExerciseList key={day.id} exercises={day.exercises} />
              </View>
            ) : null}

            {/* Everything under the list glides with it when it expands in place. */}
            <Animated.View layout={EXPAND_LAYOUT}>
              {day && hasExercises ? (
                <View style={{ paddingTop: space.inset }}>
                  <Button
                    title={resuming ? 'Resume' : 'Start'}
                    variant="black"
                    testID={resuming ? 'home-resume' : 'home-start'}
                    onPress={() => startDay(activePlan, day)}
                  />
                </View>
              ) : null}

              {day && !hasExercises ? (
                // H-2: an empty next day gets a way forward instead of a dead end.
                <View style={{ paddingTop: space.gutter }}>
                  <Button
                    title="Add exercises"
                    variant="black"
                    testID="home-add-exercises"
                    onPress={() => openPicker(activePlan, day)}
                  />
                </View>
              ) : null}

              {total > 1 ? (
                <View style={{ paddingTop: space.section }}>
                  <WeekAmount done={done} total={total} onPress={() => router.push('/weeks')} />
                </View>
              ) : onlyDayDoneAt ? (
                <View style={{ paddingTop: space.section }}>
                  <Text style={type.caption}>{formatDoneLabel(onlyDayDoneAt)}</Text>
                </View>
              ) : null}

              {otherDays.length > 0 ? (
                <View style={{ paddingTop: space.section }} testID="home-other-days">
                  <Text style={type.caption} accessibilityRole="header">
                    Other days
                  </Text>
                  <View style={{ paddingTop: space.related }}>
                    {otherDays.map((item, index) => (
                      <HomeDayRow
                        key={item.id}
                        day={item}
                        doneThisWeek={doneIds.includes(item.id)}
                        showSeparator={index < otherDays.length - 1}
                        onPress={() => openPreview(activePlan, item)}
                        testID={`home-day-row-${index}`}
                      />
                    ))}
                  </View>
                </View>
              ) : null}
            </Animated.View>
          </View>
        ) : (
          // Empty: the fact is the large title, and the one action sits under it.
          <View testID="home-empty">
            <Button
              title="Create plan"
              variant="black"
              onPress={createPlan}
              testID="home-create-plan"
            />
          </View>
        )}
      </ScrollView>
      <Stack.Screen options={{ title }} />
    </>
  );
}

/**
 * The day's exercises as one object surface, read-only: the preview sheet would only repeat
 * it (feedback F7, PRODUCT-DECISIONS 42). A long day folds after `COLLAPSED_ROWS` into a peer row that expands in place and ends with
 * `Show less`; never a sheet just to show the rest (trim-ui → Structure).
 */
function ExerciseList({ exercises }: { exercises: ExercisePrescription[] }) {
  const { colors, type } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const foldable = exercises.length > COLLAPSED_ROWS + 1;
  const visible = foldable && !expanded ? exercises.slice(0, COLLAPSED_ROWS) : exercises;
  const hidden = exercises.length - COLLAPSED_ROWS;

  return (
    // The surface itself carries the layout transition, so its fill grows with the rows.
    <Animated.View
      layout={EXPAND_LAYOUT}
      testID="home-exercise-list"
      style={{
        backgroundColor: colors.secondarySystemBackground,
        borderRadius: radius.md,
        borderCurve: 'continuous',
        padding: space.inset,
        gap: space.inset,
      }}>
      <View style={{ gap: space.inset }}>
        {visible.map((exercise, index) => (
          <Animated.View
            key={`${exercise.id}-${index}`}
            // Only rows the fold hid animate; nothing animates when Home appears.
            entering={foldable && index >= COLLAPSED_ROWS ? ROW_ENTER : undefined}
            exiting={foldable && index >= COLLAPSED_ROWS ? ROW_EXIT : undefined}>
            <ExerciseRow exercise={exercise} />
          </Animated.View>
        ))}
      </View>
      {foldable ? (
        <Pressable
          onPress={() => setExpanded((value) => !value)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          testID="home-exercise-list-more"
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.inline,
            minHeight: TOUCH_TARGET,
            opacity: pressed ? PRESSED_OPACITY : 1,
          })}>
          <Text style={[type.row, { flex: 1, color: colors.tertiaryLabel }]}>
            {expanded ? 'Show less' : `${hidden} more exercises`}
          </Text>
          <SymbolView
            name={expanded ? 'chevron.up' : 'chevron.down'}
            tintColor={colors.tertiaryLabel}
            size={iconSize.caption}
            weight="semibold"
            style={{ flexShrink: 0 }}
          />
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

function ExerciseRow({ exercise }: { exercise: ExercisePrescription }) {
  const { type } = useTheme();
  const { previousLogForExercise, units } = useWorkoutStore();
  const metric = formatPlanMetricWithLoad(exercise, previousLogForExercise(exercise.name)?.sets, units);
  return (
    <View style={{ gap: space.pair }}>
      <Text style={type.row} numberOfLines={2}>
        {exercise.name}
      </Text>
      <Text style={[type.caption, { fontVariant: ['tabular-nums'] }]}>{metric}</Text>
    </View>
  );
}

/** Wait for the modal that finished the workout to slide away before celebrating. */
const CELEBRATE_DELAY_MS = 320;

/**
 * Week amount: `n of m` + `this week` + dots. While Home is covered (log, Done, paywall) it
 * keeps showing the old amount; when Home is visible again the new dot fills with a small
 * celebration and the count rolls up, so finishing a workout lands on the goal it moved.
 * A lower count (a deleted workout, a new week) fades its dots back to grey, no ceremony.
 *
 * The whole row is one button (F6): tap opens Weeks, the last 8 weeks against the goal.
 * The trailing chevron is its affordance; without `onPress` it renders read-only, no chevron.
 */
function WeekAmount({
  done,
  total,
  onPress,
}: {
  done: number;
  total: number;
  onPress?: () => void;
}) {
  const { colors, type } = useTheme();
  const isFocused = useIsFocused();
  const seenDone = useRef<number | null>(null);
  const [shown, setShown] = useState(done);
  const [celebrate, setCelebrate] = useState<{ index: number; weekDone: boolean; key: number } | null>(
    null,
  );

  useEffect(() => {
    if (seenDone.current == null) {
      seenDone.current = done;
      setShown(done);
      return;
    }
    if (done <= seenDone.current) {
      // A deleted workout or a new week: no ceremony. Drop the last celebration too: while a
      // dot holds a celebrateKey it ignores `filled`, so it stayed green after a delete.
      if (done < seenDone.current) {
        setCelebrate(null);
      }
      seenDone.current = done;
      setShown(done);
      return;
    }
    if (!isFocused) {
      return;
    }
    const timer = setTimeout(() => {
      seenDone.current = done;
      setShown(done);
      setCelebrate({ index: done - 1, weekDone: done >= total, key: Date.now() });
    }, CELEBRATE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [done, isFocused, total]);

  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      testID="home-week"
      hitSlop={{ top: space.related, bottom: space.related }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.inline,
        minHeight: TOUCH_TARGET,
        opacity: pressed && onPress ? PRESSED_OPACITY : 1,
      })}
      accessible
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${shown} of ${total} this week`}
      accessibilityHint={onPress ? 'Shows past weeks' : undefined}>
      <View style={{ flex: 1, gap: space.related, alignItems: 'flex-start' }}>
        {/* NumberFlow has no text baseline to align to; bottom edges match within a point. */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.tight }}>
          {/* One NumberFlow with a suffix: a sibling Text would sit on a different baseline. */}
          <StaggerValue value={shown} suffix={` of ${total}`} style={type.title} />
          <Text style={type.caption}>this week</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.related }}>
          {Array.from({ length: total }, (_, index) => (
            <WeekDot
              key={index}
              filled={index < shown}
              celebrateKey={celebrate?.index === index ? celebrate.key : null}
              waveKey={celebrate?.weekDone ? celebrate.key : null}
              waveDelay={index * WAVE_STAGGER_MS}
            />
          ))}
        </View>
      </View>
      {onPress ? (
        // The quiet affordance for F6: the week opens its past weeks.
        <SymbolView
          name="chevron.right"
          tintColor={colors.tertiaryLabel}
          size={iconSize.caption}
          weight="semibold"
          style={{ flexShrink: 0 }}
        />
      ) : null}
    </Pressable>
  );
}

const DOT = 10;
/** The rings leave 140ms apart (trim-ui → Motion → Week dot fills). */
const RING_STAGGER_MS = 140;
/** A full week: the bump starts once the new dot has popped, then crosses the dots. */
const WAVE_START_MS = 420;
const WAVE_STAGGER_MS = 70;

/**
 * One week dot. `celebrateKey` fills it with a springy pop and two soft green rings;
 * `waveKey` gives it a small staggered bump when the whole week is done.
 */
function WeekDot({
  filled,
  celebrateKey,
  waveKey,
  waveDelay,
}: {
  filled: boolean;
  celebrateKey: number | null;
  waveKey: number | null;
  waveDelay: number;
}) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const fill = useSharedValue(filled ? 1 : 0);
  const scale = useSharedValue(1);
  const ringA = useSharedValue(0);
  const ringB = useSharedValue(0);

  useEffect(() => {
    if (celebrateKey != null) {
      return;
    }
    if (filled) {
      fill.set(1);
      return;
    }
    // Going down (a deleted workout, a new week) just crossfades back to grey: no ceremony.
    // It is a color fade, so it plays under Reduce Motion too.
    fill.set(
      withTiming(0, { duration: DURATION.change, easing: EASE_OUT, reduceMotion: ReduceMotion.Never }),
    );
  }, [celebrateKey, fill, filled]);

  useEffect(() => {
    if (celebrateKey == null) {
      return;
    }
    // A color crossfade is the reduced-motion celebration: it must still play (not jump).
    fill.set(
      withTiming(1, {
        duration: reduceMotion ? DURATION.change : DURATION.fade,
        easing: EASE_OUT,
        reduceMotion: ReduceMotion.Never,
      }),
    );
    if (reduceMotion) {
      return;
    }
    scale.set(0.5);
    scale.set(withSpring(1, SPRING.pop));
    ringA.set(0);
    ringA.set(withTiming(1, { duration: DURATION.celebrate, easing: EASE_OUT }));
    ringB.set(0);
    ringB.set(
      withDelay(RING_STAGGER_MS, withTiming(1, { duration: DURATION.celebrate, easing: EASE_OUT })),
    );
  }, [celebrateKey, fill, reduceMotion, ringA, ringB, scale]);

  useEffect(() => {
    if (waveKey == null || reduceMotion) {
      return;
    }
    scale.set(
      withDelay(
        WAVE_START_MS + waveDelay,
        withSequence(
          withTiming(1.35, { duration: DURATION.press, easing: EASE_OUT }),
          withSpring(1, SPRING.settle),
        ),
      ),
    );
  }, [reduceMotion, scale, waveDelay, waveKey]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
    backgroundColor: interpolateColor(fill.get(), [0, 1], [colors.systemGray5, colors.systemGreen]),
  }));
  const ringAStyle = useAnimatedStyle(() => ({
    opacity: ringA.get() === 0 ? 0 : 0.45 * (1 - ringA.get()),
    transform: [{ scale: 1 + ringA.get() * 2.4 }],
  }));
  const ringBStyle = useAnimatedStyle(() => ({
    opacity: ringB.get() === 0 ? 0 : 0.45 * (1 - ringB.get()),
    transform: [{ scale: 1 + ringB.get() * 2.4 }],
  }));

  const ring = {
    position: 'absolute' as const,
    width: DOT,
    height: DOT,
    borderRadius: radius.full,
    backgroundColor: colors.systemGreen,
  };

  return (
    <View style={{ width: DOT, height: DOT }}>
      <Animated.View pointerEvents="none" style={[ring, ringAStyle]} />
      <Animated.View pointerEvents="none" style={[ring, ringBStyle]} />
      <Animated.View style={[{ width: DOT, height: DOT, borderRadius: radius.full }, dotStyle]} />
    </View>
  );
}
