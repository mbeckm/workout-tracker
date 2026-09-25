import { SymbolView } from 'expo-symbols';
import { Stack, useIsFocused, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutUp,
  interpolateColor,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { HomeDayRow } from '@/components/home-day-row';
import { StaggerValue } from '@/components/stagger-value';
import { PaperEmpty, PaperScreen } from '@/components/paper';
import { radius, spacing } from '@/constants/theme';
import { EASE_OUT } from '@/motion';
import { useTheme } from '@/theme/theme-context';
import {
  estimateDayMinutes,
  formatClockTime,
  formatDoneLabel,
  formatExerciseCount,
  formatLoggedSets,
  lastDoneAt,
} from '@/domain/day-facts';
import { emptyPlan, formatPlanMetricWithLoad } from '@/domain/helpers';
import { completedPlanDayIdsSince, startOfLocalWeek, trainableDays } from '@/domain/plan-loop';
import type { ExercisePrescription, WorkoutDay, WorkoutPlan } from '@/domain/types';
import { useStartDay } from '@/navigation/start-day';
import { useWorkoutStore } from '@/store/workout-store';

const VISIBLE_EXERCISES = 4;
const LIST_LAYOUT = LinearTransition.duration(220).easing(EASE_OUT);

const factBase = {
  fontSize: 15,
  fontWeight: '400' as const,
  lineHeight: 20,
};

export function WorkoutTab() {
  const { colors, type } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { activePlan, nextDayIndex, savePlan, workoutHistory, activeSession } = useWorkoutStore();
  const startDay = useStartDay();
  const [expandedForDayId, setExpandedForDayId] = useState<string | null>(null);
  const fact = { ...factBase, color: colors.tertiaryLabel };

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
    if (day.exercises.length === 0) {
      openPicker(plan, day);
      return;
    }
    router.push({ pathname: '/day-preview', params: { planId: plan.id, dayId: day.id } });
  };

  // H-8: a workout in progress on this plan takes the stage until it's finished.
  const session = activePlan && activeSession?.planId === activePlan.id ? activeSession : null;
  const sessionDay = session ? activePlan?.days.find((item) => item.id === session.dayId) : undefined;
  const day = sessionDay ?? activePlan?.days[nextDayIndex];
  const resuming = session != null && sessionDay != null;
  const hasExercises = day != null && day.exercises.length > 0;
  const overflow = day ? Math.max(0, day.exercises.length - VISIBLE_EXERCISES) : 0;
  const expanded = day != null && expandedForDayId === day.id;
  const head = day ? day.exercises.slice(0, VISIBLE_EXERCISES) : [];
  const tail = day ? day.exercises.slice(VISIBLE_EXERCISES) : [];

  const weekStart = startOfLocalWeek();
  const doneIds = completedPlanDayIdsSince(activePlan, workoutHistory, weekStart);
  const total = activePlan ? trainableDays(activePlan).length : 0;
  const done = Math.min(doneIds.length, total);

  let meta = '';
  if (activePlan && day) {
    if (resuming && session) {
      meta =
        session.loggedSetCount > 0
          ? `Started ${formatClockTime(session.startedAt)} · ${formatLoggedSets(session.loggedSetCount)}`
          : `Started ${formatClockTime(session.startedAt)}`;
    } else if (!hasExercises) {
      meta = 'No exercises yet';
    } else {
      const minutes = estimateDayMinutes(activePlan, day, workoutHistory);
      meta = [
        activePlan.name.trim(),
        formatExerciseCount(day.exercises.length),
        minutes != null ? `~${minutes} min` : '',
      ]
        .filter(Boolean)
        .join(' · ');
    }
  }

  // H-1: every other day you can train, so any day of the plan can be started from Home.
  const otherDays =
    activePlan && day
      ? activePlan.days.filter((item) => item.id !== day.id && item.exercises.length > 0)
      : [];
  const onlyDayDoneAt =
    activePlan && total <= 1 && day ? lastDoneAt(activePlan, day.id, workoutHistory) : null;

  return (
    <>
      <PaperScreen contentContainerStyle={{ paddingBottom: insets.bottom + 88 }}>
        {activePlan ? (
          <View>
            <View style={{ gap: 12 }}>
              <Text style={type.planTitle} maxFontSizeMultiplier={1.2} accessibilityRole="header">
                Next Workout
              </Text>
              {day ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${day.title}, ${meta}`}
                  accessibilityHint={hasExercises ? 'Shows this day' : 'Adds exercises to this day'}
                  testID="home-next-day"
                  onPress={() => openPreview(activePlan, day)}
                  style={({ pressed }) => ({ gap: 8, opacity: pressed ? 0.7 : 1 })}>
                  <Text style={type.displayDay} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                    {day.title}
                  </Text>
                  <Text style={fact} numberOfLines={2} testID="home-day-meta">
                    {meta}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {day && hasExercises ? (
              <Animated.View layout={reduceMotion ? undefined : LIST_LAYOUT} style={{ paddingTop: 28, gap: 20 }}>
                <Animated.View
                  layout={reduceMotion ? undefined : LIST_LAYOUT}
                  style={{
                    backgroundColor: colors.secondarySystemBackground,
                    borderRadius: radius.md,
                    borderCurve: 'continuous',
                    padding: spacing.md,
                    gap: spacing.s,
                    overflow: 'hidden',
                  }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${day.title} exercises`}
                    accessibilityHint="Shows this day"
                    onPress={() => openPreview(activePlan, day)}
                    style={({ pressed }) => ({ gap: spacing.s, opacity: pressed ? 0.7 : 1 })}>
                    {head.map((exercise, index) => (
                      <ExerciseRow key={`${exercise.id}-${index}`} exercise={exercise} />
                    ))}
                    {expanded
                      ? tail.map((exercise, index) => (
                          <Animated.View
                            key={`${exercise.id}-overflow-${index}`}
                            entering={
                              reduceMotion
                                ? FadeIn.duration(160)
                                : FadeInDown.duration(200)
                                    .delay(index * 28)
                                    .easing(EASE_OUT)
                                    .withInitialValues({
                                      opacity: 0,
                                      transform: [{ translateY: -8 }],
                                    })
                            }
                            exiting={
                              reduceMotion
                                ? FadeOut.duration(140)
                                : FadeOutUp.duration(180).easing(EASE_OUT)
                            }
                            layout={reduceMotion ? undefined : LIST_LAYOUT}>
                            <ExerciseRow exercise={exercise} />
                          </Animated.View>
                        ))
                      : null}
                  </Pressable>
                  {overflow > 0 ? (
                    <Animated.View layout={reduceMotion ? undefined : LIST_LAYOUT}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ expanded }}
                        accessibilityLabel={
                          expanded
                            ? 'Show less'
                            : `${overflow} more ${overflow === 1 ? 'exercise' : 'exercises'}`
                        }
                        testID="home-more"
                        onPress={() => setExpandedForDayId(expanded ? null : day.id)}
                        hitSlop={{ top: 6, bottom: 16 }}
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: spacing.s,
                          width: '100%',
                          minHeight: 44,
                          opacity: pressed ? 0.7 : 1,
                        })}>
                        <Text
                          style={[
                            type.row,
                            {
                              flexGrow: 1,
                              flexShrink: 1,
                              minWidth: 0,
                              color: expanded ? colors.tertiaryLabel : colors.label,
                            },
                          ]}
                          numberOfLines={1}>
                          {expanded
                            ? 'Show less'
                            : `${overflow} more ${overflow === 1 ? 'exercise' : 'exercises'}`}
                        </Text>
                        <SymbolView
                          name={expanded ? 'chevron.up' : 'chevron.down'}
                          tintColor={colors.tertiaryLabel}
                          size={14}
                          weight="medium"
                          style={{ flexShrink: 0 }}
                        />
                      </Pressable>
                    </Animated.View>
                  ) : null}
                </Animated.View>
                <Animated.View layout={reduceMotion ? undefined : LIST_LAYOUT}>
                  <Button
                    title={resuming ? 'Resume' : 'Start'}
                    variant="black"
                    testID={resuming ? 'home-resume' : 'home-start'}
                    onPress={() => startDay(activePlan, day)}
                  />
                </Animated.View>
              </Animated.View>
            ) : null}

            {day && !hasExercises ? (
              // H-2: an empty next day gets a way forward instead of a dead end.
              <View style={{ paddingTop: 28 }}>
                <Button
                  title="Add exercises"
                  variant="black"
                  testID="home-add-exercises"
                  onPress={() => openPicker(activePlan, day)}
                />
              </View>
            ) : null}

            {total > 1 ? (
              <Animated.View layout={reduceMotion ? undefined : LIST_LAYOUT} style={{ paddingTop: 40 }}>
                <WeekAmount done={done} total={total} />
              </Animated.View>
            ) : onlyDayDoneAt ? (
              <Animated.View layout={reduceMotion ? undefined : LIST_LAYOUT} style={{ paddingTop: 40 }}>
                <Text style={fact}>{formatDoneLabel(onlyDayDoneAt)}</Text>
              </Animated.View>
            ) : null}

            {otherDays.length > 0 ? (
              <Animated.View layout={reduceMotion ? undefined : LIST_LAYOUT} style={{ paddingTop: 36 }} testID="home-other-days">
                {/* Names the list: without it the rows read as an unexplained table (H-1). */}
                <Text style={[fact, { paddingBottom: 2 }]} accessibilityRole="header">
                  Other days
                </Text>
                {otherDays.map((item, index) => {
                  const doneThisWeek = doneIds.includes(item.id);
                  const doneAt = doneThisWeek ? lastDoneAt(activePlan, item.id, workoutHistory) : null;
                  return (
                    <HomeDayRow
                      key={item.id}
                      day={item}
                      doneThisWeek={doneThisWeek}
                      doneLabel={doneAt ? formatDoneLabel(doneAt) : null}
                      showSeparator={index < otherDays.length - 1}
                      onPress={() => openPreview(activePlan, item)}
                      testID={`home-day-row-${index}`}
                    />
                  );
                })}
              </Animated.View>
            ) : null}
          </View>
        ) : (
          <PaperEmpty
            testID="home-empty"
            title="Next Workout"
            subject="No plan yet"
            caption="Build your week once. Then just press Start."
            action={{ title: 'Create plan', onPress: createPlan, testID: 'home-create-plan' }}
          />
        )}
      </PaperScreen>
      <Stack.Screen options={{ headerShown: false, title: 'Workout' }} />
    </>
  );
}

function ExerciseRow({ exercise }: { exercise: ExercisePrescription }) {
  const { colors, type } = useTheme();
  const { previousLogForExercise, units } = useWorkoutStore();
  const metric = formatPlanMetricWithLoad(exercise, previousLogForExercise(exercise.name)?.sets, units);
  const fact = { ...factBase, color: colors.tertiaryLabel };
  return (
    <View style={{ gap: 2 }}>
      <Text style={type.row} numberOfLines={1}>
        {exercise.name}
      </Text>
      <Text style={[fact, { fontVariant: ['tabular-nums'] }]}>{metric}</Text>
    </View>
  );
}

/** Wait for the modal that finished the workout to slide away before celebrating. */
const CELEBRATE_DELAY_MS = 320;

/**
 * Week amount: `n of m this week` + dots. While Home is covered (log, Done, paywall) it
 * keeps showing the old amount; when Home is visible again the new dot fills with a small
 * celebration and the count rolls up, so finishing a workout lands on the goal it moved.
 */
function WeekAmount({ done, total }: { done: number; total: number }) {
  const { colors, type } = useTheme();
  const fact = { ...factBase, color: colors.tertiaryLabel };
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
      // A deleted workout or a new week: no ceremony.
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
    <View
      style={{ gap: spacing.s, alignItems: 'flex-start' }}
      accessible
      accessibilityLabel={`${shown} of ${total} this week`}>
      {/* NumberFlow has no text baseline to align to; bottom edges match within a point. */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
        {/* One NumberFlow with a suffix: a sibling Text would sit on a different baseline. */}
        <StaggerValue value={shown} suffix={` of ${total}`} style={type.title} />
        <Text style={[fact, { lineHeight: 18, paddingBottom: 1 }]}>this week</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {Array.from({ length: total }, (_, index) => (
          <WeekDot
            key={index}
            filled={index < shown}
            celebrateKey={celebrate?.index === index ? celebrate.key : null}
            waveKey={celebrate?.weekDone ? celebrate.key : null}
            waveDelay={index * 70}
          />
        ))}
      </View>
    </View>
  );
}

const DOT = 10;

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
    fill.set(filled ? 1 : 0);
  }, [celebrateKey, fill, filled]);

  useEffect(() => {
    if (celebrateKey == null) {
      return;
    }
    fill.set(withTiming(1, { duration: reduceMotion ? 220 : 160, easing: EASE_OUT }));
    if (reduceMotion) {
      return;
    }
    scale.set(0.5);
    scale.set(withSpring(1, { duration: 520, dampingRatio: 0.42 }));
    ringA.set(0);
    ringA.set(withTiming(1, { duration: 760, easing: EASE_OUT }));
    ringB.set(0);
    ringB.set(withDelay(140, withTiming(1, { duration: 760, easing: EASE_OUT })));
  }, [celebrateKey, fill, reduceMotion, ringA, ringB, scale]);

  useEffect(() => {
    if (waveKey == null || reduceMotion) {
      return;
    }
    scale.set(
      withDelay(
        420 + waveDelay,
        withSequence(
          withTiming(1.35, { duration: 140, easing: EASE_OUT }),
          withSpring(1, { duration: 360, dampingRatio: 0.5 }),
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
