import { SymbolView } from 'expo-symbols';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, ReduceMotion } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { HomeDayRow } from '@/components/home-day-row';
import { WeekProgress } from '@/components/week-progress';
import { iconSize, PRESSED_OPACITY, radius, space, TOUCH_TARGET } from '@/constants/theme';
import { DURATION, EASE_IN_OUT, EASE_OUT } from '@/motion';
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
import {
  completedPlanDayIdsSince,
  startOfLocalWeek,
  trainableDays,
  workoutsSince,
} from '@/domain/plan-loop';
import type { ExercisePrescription, WorkoutDay, WorkoutPlan } from '@/domain/types';
import { formatWeekStreak, STREAK_MIN, weekStreak } from '@/domain/weeks';
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
 * Home (trim-ui → Per screen → Home). The day name is the native large title, alone. Then the
 * day's exercises as one object surface with Start right under it and the estimated duration
 * under Start, the week, and the plan's other days.
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
  // Every workout counts toward the week, a repeated day too; the checks show which days.
  const done = Math.min(workoutsSince(workoutHistory, weekStart), total);
  const streak = weekStreak(activePlan, workoutHistory);

  // One fact, under Start (G3, PRODUCT-DECISIONS 58): what tapping it costs, how long the day
  // takes, or, mid-workout, when it started. An empty day has no fact: `Add exercises` says it.
  let fact: { text: string; spoken?: string } | null = null;
  if (activePlan && day && hasExercises) {
    if (resuming && session) {
      fact = { text: `Started ${formatClockTime(session.startedAt)}` };
    } else {
      const minutes = estimateDayMinutes(activePlan, day, workoutHistory);
      fact =
        minutes != null
          ? { text: formatEstimateMinutes(minutes), spoken: spokenEstimateMinutes(minutes) }
          : null;
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
        // Insets for the large title bar and the tab bar come from the system. Content shares
        // the title's leading edge (trim-ui → Layout → Under a large title).
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingHorizontal: space.margin, paddingBottom: space.pause }}
        testID="home-scroll">
        {activePlan ? (
          <View testID="home-next-day">
            {/* The day's name stands alone as the title block: the list sits `section` under the bar. */}
            {day && hasExercises ? (
              <View style={{ paddingTop: space.section }}>
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
                  {/* The note under a full-width CTA, centered like the paywall's price note. */}
                  {fact ? (
                    <Text
                      style={[
                        type.caption,
                        { paddingTop: space.related, textAlign: 'center', fontVariant: ['tabular-nums'] },
                      ]}
                      accessibilityLabel={fact.spoken}
                      testID="home-day-meta">
                      {fact.text}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {day && !hasExercises ? (
                // H-2: an empty next day gets a way forward instead of a dead end.
                <View style={{ paddingTop: space.section }}>
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
                  <WeekAmount
                    done={done}
                    total={total}
                    streak={streak}
                    onPress={() => router.push('/weeks')}
                  />
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
          <View testID="home-empty" style={{ paddingTop: space.section }}>
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

/**
 * Week amount: `n of m` + `this week` + dots, as one button (F6): tap opens Weeks, the last 8
 * weeks against the goal. The trailing chevron is its affordance; without `onPress` it renders
 * read-only, no chevron. The dot a workout fills celebrates on Done, where the workout lands
 * (PRODUCT-DECISIONS 46), so Home just shows the amount. A lower count (a deleted workout, a
 * new week) fades its dots back to grey, no ceremony. Full weeks in a row trail the dots
 * (`4 weeks in a row`, PRODUCT-DECISIONS 51).
 */
function WeekAmount({
  done,
  total,
  streak,
  onPress,
}: {
  done: number;
  total: number;
  streak: number;
  onPress?: () => void;
}) {
  const { colors } = useTheme();

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
      accessibilityLabel={
        streak >= STREAK_MIN
          ? `${done} of ${total} this week, ${formatWeekStreak(streak)}`
          : `${done} of ${total} this week`
      }
      accessibilityHint={onPress ? 'Shows past weeks' : undefined}>
      <View style={{ flex: 1 }}>
        <WeekProgress done={done} total={total} streak={streak} />
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
