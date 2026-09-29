import { SymbolView } from 'expo-symbols';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, ReduceMotion } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { HomeDayRow } from '@/components/home-day-row';
import { StaggerValue } from '@/components/stagger-value';
import { WeekDays } from '@/components/week-days';
import { fontScaleCap, iconSize, PRESSED_OPACITY, space, TOUCH_TARGET } from '@/constants/theme';
import {
  estimateDayMinutes,
  formatClockTime,
  formatDoneLabel,
  formatEstimateMinutes,
  lastDoneAt,
  spokenEstimateMinutes,
} from '@/domain/day-facts';
import { emptyPlan, formatLoadWithUnit, formatPlanMetric } from '@/domain/helpers';
import {
  formatLastSession,
  formatWhenInline,
  liftNumber,
  weekDayMarks,
  type LiftNumber,
} from '@/domain/home-numbers';
import {
  completedPlanDayIdsSince,
  startOfLocalWeek,
  trainableDays,
  workoutsSince,
} from '@/domain/plan-loop';
import type { ExercisePrescription, WorkoutDay, WorkoutPlan } from '@/domain/types';
import { formatWeekStreak, STREAK_MIN, weekStreak } from '@/domain/weeks';
import { DURATION, EASE_IN_OUT, EASE_OUT } from '@/motion';
import { useStartDay } from '@/navigation/start-day';
import { useWorkoutStore } from '@/store/workout-store';
import { useTheme } from '@/theme/theme-context';

/** Rows shown before the list folds into a peer `n more exercises` row (as on the classic Home). */
const COLLAPSED_ROWS = 4;

/**
 * From the larger Dynamic Type sizes up (xxxLarge and the accessibility sizes), a row's load
 * stacks under the name instead of squeezing it to an ellipsis, as iOS lists do.
 */
const STACK_FONT_SCALE = 1.3;

const EXPAND_LAYOUT = LinearTransition.duration(DURATION.enter).easing(EASE_IN_OUT);
const ROW_ENTER = FadeIn.duration(DURATION.enter).easing(EASE_IN_OUT).reduceMotion(ReduceMotion.Never);
const ROW_EXIT = FadeOut.duration(DURATION.exit).easing(EASE_OUT).reduceMotion(ReduceMotion.Never);

type Units = 'kg' | 'lbs';

/**
 * Home, "Your numbers" (exploration, PRODUCT-DECISIONS 52). Same job as the classic Home
 * (`workout-tab.tsx`), but it leads with the user's own numbers instead of the plan:
 *
 * - under the day's name, when this day was last done and how long it took;
 * - a hero for the day's first weighted lift: the number to beat (Pro: today's target and how
 *   much it goes up; free: last time's heaviest set);
 * - every exercise with today's load in the trailing lane, a green ↑ where the target goes up;
 * - the week as seven days with a check on each day trained.
 */
export function WorkoutTabNumbers() {
  const { colors, type } = useTheme();
  const router = useRouter();
  const { activePlan, nextDayIndex, savePlan, workoutHistory, activeSession, isPro, units } =
    useWorkoutStore();
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

  // A workout in progress on this plan takes the stage until it's finished.
  const session = activePlan && activeSession?.planId === activePlan.id ? activeSession : null;
  const sessionDay = session ? activePlan?.days.find((item) => item.id === session.dayId) : undefined;
  const day = sessionDay ?? activePlan?.days[nextDayIndex] ?? activePlan?.days[0];
  const resuming = session != null && sessionDay != null;
  const hasExercises = day != null && day.exercises.length > 0;

  const numbers = useMemo(
    () => (day ? day.exercises.map((exercise) => liftNumber(exercise, workoutHistory, units, isPro)) : []),
    [day, isPro, units, workoutHistory],
  );
  const heroIndex = numbers.findIndex((number) => number != null);
  const hero = heroIndex >= 0 && day ? { name: day.exercises[heroIndex].name, number: numbers[heroIndex]! } : null;

  const weekStart = startOfLocalWeek();
  const doneIds = completedPlanDayIdsSince(activePlan, workoutHistory, weekStart);
  const total = activePlan ? trainableDays(activePlan).length : 0;
  const done = Math.min(workoutsSince(workoutHistory, weekStart), total);
  const streak = weekStreak(activePlan, workoutHistory);
  const marks = weekDayMarks(workoutHistory, weekStart);

  // One fact under the title: when this day was last done and how long it took. Before the
  // first time, the estimate; mid-workout, when it started.
  let fact: { text: string; spoken?: string } | null = null;
  const dayLastAt = activePlan && day ? lastDoneAt(activePlan, day.id, workoutHistory) : null;
  if (activePlan && day) {
    const last = dayLastAt
      ? workoutHistory.find((workout) => workout.completedAt === dayLastAt)
      : undefined;
    if (resuming && session) {
      fact = { text: `Started ${formatClockTime(session.startedAt)}` };
    } else if (!hasExercises) {
      fact = { text: 'No exercises yet' };
    } else if (last) {
      fact = { text: formatLastSession(last) };
    } else {
      const minutes = estimateDayMinutes(activePlan, day, workoutHistory);
      fact =
        minutes != null
          ? { text: formatEstimateMinutes(minutes), spoken: spokenEstimateMinutes(minutes) }
          : null;
    }
  }

  const otherDays =
    activePlan && day
      ? activePlan.days.filter((item) => item.id !== day.id && item.exercises.length > 0)
      : [];
  const onlyDayDoneAt =
    activePlan && total <= 1 && day ? lastDoneAt(activePlan, day.id, workoutHistory) : null;

  const title = day?.title ?? (activePlan ? 'Workout' : 'No plan yet');

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.systemBackground }}
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

            {hero && hasExercises && !resuming ? (
              <View style={{ paddingTop: space.section }}>
                <LiftHero
                  name={hero.name}
                  number={hero.number}
                  units={units}
                  // The line above already says when this day was last done.
                  showWhen={hero.number.lastAt !== dayLastAt}
                />
              </View>
            ) : null}

            {day && hasExercises ? (
              <View style={{ paddingTop: space.gutter }}>
                <ExerciseList key={day.id} exercises={day.exercises} numbers={numbers} units={units} />
              </View>
            ) : null}

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
                  <WeekBlock
                    done={done}
                    total={total}
                    streak={streak}
                    onPress={() => router.push('/weeks')}>
                    <WeekDays marks={marks} />
                  </WeekBlock>
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
          <View testID="home-empty">
            <Button title="Create plan" variant="black" onPress={createPlan} testID="home-create-plan" />
          </View>
        )}
      </ScrollView>
      <Stack.Screen options={{ title }} />
    </>
  );
}

/**
 * The number to beat, for the day's first weighted lift. Pro with a heavier target: `Bench
 * Press today`, `62.5 kg`, `↑ 2.5 kg more than last time`. Free (or a target that holds):
 * `Bench Press last time`, `60 kg`, `6 reps, Thu 17`.
 */
function LiftHero({
  name,
  number,
  units,
  showWhen,
}: {
  name: string;
  number: LiftNumber;
  units: Units;
  showWhen: boolean;
}) {
  const { colors, type } = useTheme();
  const goesUp = number.loadUp != null || number.repsUp != null;
  const upText =
    number.loadUp != null
      ? formatLoadWithUnit(number.loadUp, units)
      : number.repsUp != null
        ? `${number.repsUp} ${number.repsUp === 1 ? 'rep' : 'reps'}`
        : null;
  const when = formatWhenInline(number.lastAt);
  const spoken = goesUp
    ? `${name} today, ${formatLoadWithUnit(number.load, units)}, ${upText} more than last time`
    : `${name} last time, ${formatLoadWithUnit(number.load, units)}${number.reps != null ? ` for ${number.reps} reps` : ''}, ${when}`;

  return (
    <View accessible accessibilityLabel={spoken} testID="home-lift-hero">
      <Text style={type.caption} numberOfLines={2}>
        {goesUp ? `${name} today` : `${name} last time`}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.related }}>
        <Text
          style={[type.hero, { fontVariant: ['tabular-nums'] }]}
          maxFontSizeMultiplier={fontScaleCap.display}>
          {formatLoad(number.load)}
        </Text>
        <Text style={type.title} maxFontSizeMultiplier={fontScaleCap.title}>
          {units}
        </Text>
      </View>
      {goesUp && upText ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.tight }}>
          <SymbolView
            name="arrow.up"
            tintColor={colors.systemGreen}
            size={iconSize.row}
            weight="bold"
          />
          {/* Green at `title` size, as Progress's up-delta (trim-ui → Charts 2). */}
          <Text
            style={[type.title, { color: colors.systemGreen, fontVariant: ['tabular-nums'] }]}
            maxFontSizeMultiplier={fontScaleCap.title}>
            {upText}
          </Text>
          <Text style={type.caption}>more than last time</Text>
        </View>
      ) : (
        <Text style={[type.caption, { fontVariant: ['tabular-nums'] }]}>
          {[number.reps != null ? `${number.reps} reps` : null, showWhen ? when : null]
            .filter(Boolean)
            .join(', ')}
        </Text>
      )}
    </View>
  );
}

/** `62.5`, `60`: the load alone, for a number whose unit sits beside it. */
function formatLoad(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/**
 * The day's exercises as rows on the page (no gray surface): name over the prescription on
 * the left, today's load in the trailing lane at `title` size, with a green ↑ when the Pro
 * target raises it. Folds after `COLLAPSED_ROWS` like the classic Home.
 */
function ExerciseList({
  exercises,
  numbers,
  units,
}: {
  exercises: ExercisePrescription[];
  numbers: (LiftNumber | null)[];
  units: Units;
}) {
  const { colors, type } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const foldable = exercises.length > COLLAPSED_ROWS + 1;
  const visibleCount = foldable && !expanded ? COLLAPSED_ROWS : exercises.length;
  const hidden = exercises.length - COLLAPSED_ROWS;

  return (
    <Animated.View layout={EXPAND_LAYOUT} testID="home-exercise-list">
      {exercises.slice(0, visibleCount).map((exercise, index) => (
        <Animated.View
          key={`${exercise.id}-${index}`}
          entering={foldable && index >= COLLAPSED_ROWS ? ROW_ENTER : undefined}
          exiting={foldable && index >= COLLAPSED_ROWS ? ROW_EXIT : undefined}>
          <ExerciseRow
            exercise={exercise}
            number={numbers[index] ?? null}
            units={units}
            showSeparator={index < visibleCount - 1 || foldable}
          />
        </Animated.View>
      ))}
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
            paddingVertical: space.related,
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

function ExerciseRow({
  exercise,
  number,
  units,
  showSeparator,
}: {
  exercise: ExercisePrescription;
  number: LiftNumber | null;
  units: Units;
  showSeparator: boolean;
}) {
  const { colors, type } = useTheme();
  const metric = formatPlanMetric(exercise);
  const up = number?.loadUp != null;
  const stacked = useWindowDimensions().fontScale >= STACK_FONT_SCALE;
  return (
    <View
      accessible
      accessibilityLabel={[
        exercise.name,
        metric,
        number ? `${formatLoadWithUnit(number.load, units)}${up ? ', up from last time' : ''}` : null,
      ]
        .filter(Boolean)
        .join(', ')}
      style={{
        flexDirection: stacked ? 'column' : 'row',
        alignItems: stacked ? 'flex-start' : 'center',
        gap: stacked ? space.tight : space.inline,
        minHeight: TOUCH_TARGET,
        paddingVertical: space.inline,
        borderBottomWidth: showSeparator ? StyleSheet.hairlineWidth : 0,
        borderBottomColor: colors.separator,
      }}>
      <View style={{ flex: stacked ? undefined : 1, minWidth: 0, gap: space.pair }}>
        <Text style={type.row} numberOfLines={2}>
          {exercise.name}
        </Text>
        <Text style={[type.caption, { fontVariant: ['tabular-nums'] }]}>{metric}</Text>
      </View>
      {number ? (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.tight, flexShrink: 0 }}>
          {up ? (
            <SymbolView
              name="arrow.up"
              tintColor={colors.systemGreen}
              size={iconSize.caption}
              weight="bold"
            />
          ) : null}
          <Text
            style={[type.title, { fontVariant: ['tabular-nums'] }]}
            maxFontSizeMultiplier={fontScaleCap.title}>
            {formatLoad(number.load)}
          </Text>
          <Text style={type.caption}>{units}</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * `2 of 5 this week` (+ `4 weeks in a row`) over the seven days. The whole block opens Weeks,
 * as the classic Home's week row does; the chevron is its affordance.
 */
function WeekBlock({
  done,
  total,
  streak,
  onPress,
  children,
}: {
  done: number;
  total: number;
  streak: number;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const { colors, type } = useTheme();
  const showStreak = streak >= STREAK_MIN;
  return (
    <Pressable
      onPress={onPress}
      testID="home-week"
      accessibilityRole="button"
      accessibilityLabel={
        showStreak
          ? `${done} of ${total} this week, ${formatWeekStreak(streak)}`
          : `${done} of ${total} this week`
      }
      accessibilityHint="Shows past weeks"
      style={({ pressed }) => ({ gap: space.inset, opacity: pressed ? PRESSED_OPACITY : 1 })}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: space.inline }}>
        <View style={{ flexGrow: 1, flexDirection: 'row', alignItems: 'flex-end', gap: space.tight }}>
          <StaggerValue value={done} suffix={` of ${total}`} style={type.title} />
          <Text style={type.caption}>this week</Text>
        </View>
        {showStreak ? (
          <Text style={[type.caption, { color: colors.label, fontVariant: ['tabular-nums'] }]}>
            {formatWeekStreak(streak)}
          </Text>
        ) : null}
        <SymbolView
          name="chevron.right"
          tintColor={colors.tertiaryLabel}
          size={iconSize.caption}
          weight="semibold"
          style={{ flexShrink: 0 }}
        />
      </View>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {children}
      </View>
    </Pressable>
  );
}
