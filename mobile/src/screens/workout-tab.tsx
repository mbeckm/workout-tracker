import { SymbolView } from 'expo-symbols';
import { Stack, useIsFocused, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  interpolateColor,
  ReduceMotion,
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
import { meta, MetaRow, type MetaItem } from '@/components/meta-row';
import { StaggerValue } from '@/components/stagger-value';
import { PaperScreen } from '@/components/paper';
import { radius, spacing } from '@/constants/theme';
import { EASE_OUT } from '@/motion';
import { useTheme } from '@/theme/theme-context';
import {
  estimateDayMinutes,
  formatClockTime,
  formatDoneLabel,
  lastDoneAt,
} from '@/domain/day-facts';
import { emptyPlan, formatPlanMetricWithLoad, setCount } from '@/domain/helpers';
import { completedPlanDayIdsSince, startOfLocalWeek, trainableDays } from '@/domain/plan-loop';
import type { ExercisePrescription, WorkoutDay, WorkoutPlan } from '@/domain/types';
import { useStartDay } from '@/navigation/start-day';
import { useWorkoutStore } from '@/store/workout-store';

/**
 * Home rhythm (F2, G6). One hero: the day name is the page's title, where every other tab has
 * its title, with no label over it (an eyebrow on the biggest type in the app read as a second
 * heading). The next workout is one object (title → meta → the whole list → Start, tight), then
 * an unmistakable pause, then the week, then the other days under a real list header.
 */
const GAP_TITLE_TO_META = 6;
const GAP_META_TO_LIST = 20;
const GAP_LIST_TO_START = 12;
const GAP_TO_WEEK = 64;
const GAP_TO_OTHER_DAYS = 40;

/**
 * Dynamic Type caps, so the hierarchy holds at every text size (the hero grows least in
 * ratio but always stays biggest in points):
 * - day title 40 × 1.2 = 48 (hero)
 * - exercise list 17 × 1.8 ≈ 31, prescriptions and the hero's meta row 15 × 1.8 = 27
 * - week amount 20 × 1.5 = 30, `this week` 15 × 1.5 ≈ 23
 * - Other days header and rows 17 × 1.35 ≈ 23 (meta ≈ 20)
 * Below the caps everything follows Dynamic Type exactly.
 */
const LIST_MAX_SCALE = 1.8;
const WEEK_MAX_SCALE = 1.5;
const OTHER_DAYS_MAX_SCALE = 1.35;

const factBase = {
  fontSize: 15,
  fontWeight: '400' as const,
  lineHeight: 20,
};

export function WorkoutTab() {
  const { colors, type } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activePlan, nextDayIndex, savePlan, workoutHistory, activeSession } = useWorkoutStore();
  const startDay = useStartDay();
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

  // F7: only the other days open a preview. The next day's list on Home already is its preview.
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

  // F8/G2: the day's facts as a meta row, closed by the plan's name so Home always says which
  // plan this is. Last and in plain grey: present, never louder than the counts.
  let dayMeta: (MetaItem | null)[] = [];
  if (activePlan && day) {
    const planName = activePlan.name.trim();
    const plan = planName ? meta.plan(planName) : null;
    if (resuming && session) {
      const plannedSets = day.exercises.reduce((sum, exercise) => sum + setCount(exercise), 0);
      dayMeta = [
        meta.started(formatClockTime(session.startedAt)),
        session.loggedSetCount > 0 ? meta.sets(session.loggedSetCount, plannedSets) : null,
        plan,
      ];
    } else if (hasExercises) {
      const minutes = estimateDayMinutes(activePlan, day, workoutHistory);
      dayMeta = [
        meta.exercises(day.exercises.length),
        minutes != null ? meta.minutes(minutes, { estimate: true }) : null,
        plan,
      ];
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
            {day ? (
              // F7/G6: the day's identity is read-only and needs no label: it sits where every
              // tab's title sits, its list is right below, and Start is the action. VoiceOver
              // still hears what it is.
              <View style={{ gap: GAP_TITLE_TO_META }} testID="home-next-day">
                <Text
                  style={type.displayDay}
                  accessibilityRole="header"
                  accessibilityLabel={`${resuming ? 'Workout in progress' : 'Next workout'}, ${day.title}`}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  maxFontSizeMultiplier={1.2}>
                  {day.title}
                </Text>
                {hasExercises || resuming ? (
                  <MetaRow items={dayMeta} testID="home-day-meta" />
                ) : (
                  <Text style={fact} testID="home-day-meta">
                    No exercises yet
                  </Text>
                )}
              </View>
            ) : null}

            {day && hasExercises ? (
              <View style={{ paddingTop: GAP_META_TO_LIST, gap: GAP_LIST_TO_START }}>
                {/*
                  G1: the whole day, always. A cut-off list read as an incomplete plan, and the
                  count in the meta row now always matches the rows. Read-only (F7): tapping the
                  list used to open a sheet that repeated it.
                */}
                <View
                  testID="home-exercise-list"
                  style={{
                    backgroundColor: colors.secondarySystemBackground,
                    borderRadius: radius.md,
                    borderCurve: 'continuous',
                    padding: spacing.md,
                    gap: spacing.s,
                  }}>
                  {day.exercises.map((exercise, index) => (
                    <ExerciseRow key={`${exercise.id}-${index}`} exercise={exercise} />
                  ))}
                </View>
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
              <View style={{ paddingTop: GAP_META_TO_LIST }}>
                <Button
                  title="Add exercises"
                  variant="black"
                  testID="home-add-exercises"
                  onPress={() => openPicker(activePlan, day)}
                />
              </View>
            ) : null}

            {total > 1 ? (
              <View style={{ paddingTop: GAP_TO_WEEK }}>
                <WeekAmount done={done} total={total} onPress={() => router.push('/weeks')} />
              </View>
            ) : onlyDayDoneAt ? (
              <View style={{ paddingTop: GAP_TO_WEEK }}>
                <Text style={fact}>{formatDoneLabel(onlyDayDoneAt)}</Text>
              </View>
            ) : null}

            {otherDays.length > 0 ? (
              <View style={{ paddingTop: GAP_TO_OTHER_DAYS }} testID="home-other-days">
                {/*
                  Names the list (H-1: without it the rows read as an unexplained table). A list
                  header in ink, 17 semibold over 17 regular rows, not a grey caption: it names
                  a section, so it shouldn't look like a fact (G6).
                */}
                <Text
                  style={[type.body, { fontWeight: '600', paddingBottom: 2 }]}
                  accessibilityRole="header"
                  maxFontSizeMultiplier={OTHER_DAYS_MAX_SCALE}>
                  Other days
                </Text>
                {otherDays.map((item, index) => {
                  const doneThisWeek = doneIds.includes(item.id);
                  const doneAt = doneThisWeek ? lastDoneAt(activePlan, item.id, workoutHistory) : null;
                  const minutes = estimateDayMinutes(activePlan, item, workoutHistory);
                  return (
                    <HomeDayRow
                      key={item.id}
                      day={item}
                      // Counts, not exercise names: the names were the noisiest line on Home
                      // (long, grey, cut off). The preview lists them one tap away.
                      meta={[
                        meta.exercises(item.exercises.length),
                        doneAt
                          ? meta.lastDone(doneAt)
                          : minutes != null
                            ? meta.minutes(minutes, { estimate: true })
                            : null,
                      ]}
                      doneThisWeek={doneThisWeek}
                      showSeparator={index < otherDays.length - 1}
                      onPress={() => openPreview(activePlan, item)}
                      testID={`home-day-row-${index}`}
                    />
                  );
                })}
              </View>
            ) : null}
          </View>
        ) : (
          // Same hero as a planned Home, so the tab doesn't change voice when empty.
          <View testID="home-empty">
            <Text style={type.displayDay} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
              No plan yet
            </Text>
            <Text style={[fact, { paddingTop: GAP_TITLE_TO_META }]}>
              Build your week once. Then just press Start.
            </Text>
            <View style={{ paddingTop: GAP_META_TO_LIST + 8 }}>
              <Button
                title="Create plan"
                variant="black"
                onPress={createPlan}
                testID="home-create-plan"
              />
            </View>
          </View>
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
      {/* Two lines before truncating: at large text a long name wraps instead of `Dumbbell Ben…`. */}
      <Text style={type.row} numberOfLines={2} maxFontSizeMultiplier={LIST_MAX_SCALE}>
        {exercise.name}
      </Text>
      <Text
        style={[fact, { fontVariant: ['tabular-nums'] }]}
        maxFontSizeMultiplier={LIST_MAX_SCALE}>
        {metric}
      </Text>
    </View>
  );
}

/**
 * Week amount voice: secondary to the day title (40 bold). 20 semibold, not the 22 bold
 * Title voice, so the week reads as a status under the workout rather than a second heading.
 */
const WEEK_COUNT = {
  fontSize: 20,
  fontWeight: '600' as const,
  letterSpacing: -0.3,
} as const;

/** Wait for the modal that finished the workout to slide away before celebrating. */
const CELEBRATE_DELAY_MS = 320;

/**
 * Week amount: `n of m this week` + dots. While Home is covered (log, Done, paywall) it
 * keeps showing the old amount; when Home is visible again the new dot fills with a small
 * celebration and the count rolls up, so finishing a workout lands on the goal it moved.
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
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const fact = { ...factBase, color: colors.tertiaryLabel };
  const isFocused = useIsFocused();
  // NumberFlow's inner Text takes no maxFontSizeMultiplier, so pre-divide by the system
  // scale: it then renders at 20 × min(scale, 1.5) instead of growing with every size.
  const weekScale = fontScale > 0 ? Math.min(fontScale, WEEK_MAX_SCALE) / fontScale : 1;
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
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      testID="home-week"
      hitSlop={{ top: 10, bottom: 10 }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.s,
        minHeight: 44,
        opacity: pressed && onPress ? 0.6 : 1,
      })}
      accessible
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${shown} of ${total} this week`}
      accessibilityHint={onPress ? 'Shows past weeks' : undefined}>
      <View style={{ flex: 1, gap: 10, alignItems: 'flex-start' }}>
        {/* NumberFlow has no text baseline to align to; bottom edges match within a point. */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
          {/* One NumberFlow with a suffix: a sibling Text would sit on a different baseline. */}
          <StaggerValue
            value={shown}
            suffix={` of ${total}`}
            style={[
              WEEK_COUNT,
              {
                fontSize: WEEK_COUNT.fontSize * weekScale,
                letterSpacing: WEEK_COUNT.letterSpacing * weekScale,
                color: colors.label,
              },
            ]}
          />
          <Text
            style={[fact, { lineHeight: 18, paddingBottom: 1 }]}
            maxFontSizeMultiplier={WEEK_MAX_SCALE}>
            this week
          </Text>
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
      {onPress ? (
        // The quiet affordance for F6: the week opens its past weeks.
        <SymbolView
          name="chevron.right"
          tintColor={colors.tertiaryLabel}
          size={14}
          weight="semibold"
          style={{ flexShrink: 0 }}
        />
      ) : null}
    </Pressable>
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
    // A color crossfade is the reduced-motion celebration: it must still play (not jump).
    fill.set(
      withTiming(1, {
        duration: reduceMotion ? 220 : 160,
        easing: EASE_OUT,
        reduceMotion: ReduceMotion.Never,
      }),
    );
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
