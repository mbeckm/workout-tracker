import { SymbolView } from 'expo-symbols';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutUp,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { HomeDayRow } from '@/components/home-day-row';
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
import { emptyPlan, formatPlanMetric } from '@/domain/helpers';
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
              <Animated.View layout={reduceMotion ? undefined : LIST_LAYOUT} style={{ paddingTop: 28 }} testID="home-other-days">
                {otherDays.map((item, index) => {
                  const doneAt = lastDoneAt(activePlan, item.id, workoutHistory);
                  const rowMeta = doneAt
                    ? `${formatExerciseCount(item.exercises.length)} · ${formatDoneLabel(doneAt)}`
                    : formatExerciseCount(item.exercises.length);
                  return (
                    <HomeDayRow
                      key={item.id}
                      day={item}
                      meta={rowMeta}
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
  const fact = { ...factBase, color: colors.tertiaryLabel };
  return (
    <View style={{ gap: 2 }}>
      <Text style={type.row} numberOfLines={1}>
        {exercise.name}
      </Text>
      <Text style={fact}>{formatPlanMetric(exercise)}</Text>
    </View>
  );
}

function WeekAmount({ done, total }: { done: number; total: number }) {
  const { colors, type } = useTheme();
  const fact = { ...factBase, color: colors.tertiaryLabel };
  const previousDone = useRef<number | null>(null);
  const [pulseIndex, setPulseIndex] = useState<number | null>(null);

  useEffect(() => {
    if (previousDone.current == null) {
      previousDone.current = done;
      return;
    }
    if (done > previousDone.current) {
      setPulseIndex(done - 1);
    }
    previousDone.current = done;
  }, [done]);

  return (
    <View style={{ gap: spacing.s, alignItems: 'flex-start' }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
        <Text style={type.title}>
          {done} of {total}
        </Text>
        <Text style={fact}>this week</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {Array.from({ length: total }, (_, index) => (
          <WeekDot key={index} filled={index < done} pulse={pulseIndex === index} />
        ))}
      </View>
    </View>
  );
}

function WeekDot({ filled, pulse }: { filled: boolean; pulse: boolean }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!pulse || reduceMotion) {
      return;
    }
    scale.set(0.95);
    scale.set(withTiming(1, { duration: 200, easing: EASE_OUT }));
  }, [pulse, reduceMotion, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  return (
    <Animated.View
      style={[
        {
          width: 10,
          height: 10,
          borderRadius: radius.full,
          flexShrink: 0,
          backgroundColor: filled ? colors.systemGreen : colors.systemGray5,
        },
        style,
      ]}
    />
  );
}
