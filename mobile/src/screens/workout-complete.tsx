import { SymbolView } from 'expo-symbols';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Button } from '@/components/button';
import { Fact } from '@/components/fact';
import { LiftRow } from '@/components/lift-row';
import { StaggerValue } from '@/components/stagger-value';
import { fontScaleCap, iconSize, radius, space, spacing } from '@/constants/theme';
import { currentOneRM, goalsReachedIn, type Goal } from '@/domain/goals';
import { formatPaperMinutes, formatPlanMetricShort, ordinal } from '@/domain/helpers';
import { liftChangeFor, liftChanges } from '@/domain/home-numbers';
import type { LoggedExercise, LoggedWorkout, WorkoutPlan } from '@/domain/types';
import { normalizedStatsKey } from '@/domain/types';
import { DURATION, EASE_OUT, SPRING } from '@/motion';
import { queueWeekMoment } from '@/navigation/week-moment';
import { openPaywall } from '@/purchases/pro-gate';
import { useWorkoutStore } from '@/store/workout-store';
import { useTheme } from '@/theme/theme-context';

/** If the modal's `transitionEnd` never comes (web, a restored screen), land anyway. */
const LAND_FALLBACK_MS = 700;
/**
 * The rows' ↑ and crowns land once the tick has popped, 60ms apart, the last by 440ms: the
 * whole moment is over within about a second (Paper `Motion · Done → Home`).
 */
const CHANGE_START_MS = 160;
const CHANGE_STAGGER_MS = 60;
const CHANGE_LAST_MS = 440;
/** The tick (trim-ui §13 Done): a 64pt green circle, the check drawn in its middle. */
const TICK = 64;
const CHECK = 30;
/** The check's path on a 17pt grid, and its length, so the stroke can draw itself. */
const CHECK_PATH = 'M3 9l3.5 3.5L14 4.5';
const CHECK_LENGTH = 16;
const CHECK_STROKE = 2.4;

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Done v2 (trim-ui §13 Done, PRODUCT-DECISIONS 61): what did I just do, and did it get better.
 * A green tick pops in and draws itself as the modal lands, then the day as the title with its
 * duration, then each lift as one row with what changed (↑ `2.5 kg` in ink, `same`, the crown
 * on a record), each ↑ rising into place. No week or streak here: that moment plays on Home
 * after Done (`queueWeekMoment`). The green Done is live from the first frame, and nothing
 * here waits on the motion.
 */
export function WorkoutCompleteScreen() {
  const { colors, type } = useTheme();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { workoutHistory, lastCompletedWorkout, shouldOfferPostWorkoutPaywall } = useWorkoutStore();
  const leaving = useRef(false);
  const workout =
    workoutHistory.find((item) => item.id === id) ??
    (lastCompletedWorkout?.id === id ? lastCompletedWorkout : null);
  const { units, milestoneFor, claimMilestone, activePlan, goals } = useWorkoutStore();
  const milestone = workout ? milestoneFor(workout) : null;
  const workoutId = workout?.id;

  // Shown once ever (trim-ui §12 Moments): the first Done that shows it claims it.
  useEffect(() => {
    if (milestone && workoutId) {
      claimMilestone(milestone, workoutId);
    }
  }, [claimMilestone, milestone, workoutId]);
  const changes = useMemo(
    () => (workout ? liftChanges(workout, workoutHistory) : null),
    [workout, workoutHistory],
  );

  // The moment starts on the frame the modal finishes sliding in (trim-ui → Moments: after
  // the action lands). Until then the week shows its old amount.
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    let didLand = false;
    const land = () => {
      if (!didLand) {
        didLand = true;
        setLanded(true);
      }
    };
    const timer = setTimeout(land, LAND_FALLBACK_MS);
    const unsubscribe = navigation.addListener(
      'transitionEnd' as never,
      (event: { data?: { closing?: boolean } }) => {
        if (!event.data?.closing) {
          land();
        }
      },
    );
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [navigation]);

  const done = async () => {
    if (leaving.current) {
      return;
    }
    leaving.current = true;
    // The week celebrates on Home once Done has gone (trim-ui §13 Home week details).
    if (workout) {
      queueWeekMoment(workout.id);
    }
    // The paywall marks the offer shown only once prices render, so a failed load retries next time.
    if (shouldOfferPostWorkoutPaywall) {
      await openPaywall('post_workout');
    }
    // Pop back to the existing tabs instead of replacing into a second tab navigator.
    router.dismissTo('/');
  };

  if (!workout) {
    return (
      <>
        <View
          style={{
            flex: 1,
            backgroundColor: colors.systemBackground,
            padding: space.gutter,
            justifyContent: 'center',
            gap: space.inset,
          }}>
          <Text style={type.hero} maxFontSizeMultiplier={fontScaleCap.display}>
            Done
          </Text>
          <Button
            title="Done"
            variant="green"
            onPress={() => void done()}
          />
        </View>
        <Stack.Screen options={{ headerShown: false, gestureEnabled: false, title: 'Done' }} />
      </>
    );
  }

  const minutes = formatPaperMinutes(workout.durationMinutes);
  let changed = 0;

  return (
    <>
      <View
        style={{
          flex: 1,
          backgroundColor: colors.systemBackground,
          paddingTop: insets.top,
          paddingBottom: Math.max(insets.bottom, space.inline),
        }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: space.pause,
            paddingHorizontal: space.gutter,
            paddingBottom: space.gutter,
          }}>
          <DoneTick landed={landed} />
          <View style={{ paddingTop: space.gutter, gap: space.related }}>
            <Text
              style={type.displayCompact}
              accessibilityRole="header"
              numberOfLines={2}
              maxFontSizeMultiplier={fontScaleCap.display}>
              {workout.title}
            </Text>
            <View>
              <View accessible accessibilityLabel={`Done, ${minutes}`} testID="done-facts">
                <Fact kind="duration">{minutes}</Fact>
              </View>
              {milestone ? <MilestoneFact milestone={milestone} landed={landed} /> : null}
            </View>
          </View>
          {goalsReachedIn(workout, goals).map((goal) => (
            <View key={goal.id} style={{ paddingTop: space.section }}>
              <GoalReached
                goal={goal}
                from={goalStart(goal, workout, workoutHistory)}
                units={units}
                landed={landed}
              />
            </View>
          ))}
          <View style={{ paddingTop: space.section }} testID="done-lifts">
            {workout.exercises.map((exercise, index) => {
              const change = changes ? liftChangeFor(changes, exercise.exerciseName) : null;
              const moves = change != null && (change.record || change.kind === 'up' || change.kind === 'down');
              const delayMs = moves
                ? Math.min(CHANGE_START_MS + changed++ * CHANGE_STAGGER_MS, CHANGE_LAST_MS)
                : 0;
              return (
                <LiftRow
                  key={exercise.id}
                  name={exercise.exerciseName}
                  metric={doneMetric(exercise, workout, activePlan)}
                  change={change}
                  units={units}
                  showSeparator={index < workout.exercises.length - 1}
                  landed={landed}
                  delayMs={delayMs}
                  testID={`done-recap-${exercise.id}`}
                />
              );
            })}
          </View>
        </ScrollView>
        <View style={{ paddingHorizontal: space.gutter }}>
          <Button title="Done" variant="green" testID="done-cta" onPress={() => void done()} />
        </View>
      </View>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false, title: 'Done' }} />
    </>
  );
}

/** Where the goal's track stood before this workout: the lift's 1RM then, over the target. */
function goalStart(goal: Goal, workout: LoggedWorkout, history: LoggedWorkout[]): number {
  const before = currentOneRM(
    goal.exerciseName,
    history.filter((item) => item.id !== workout.id && item.completedAt < workout.completedAt),
  );
  return before != null && goal.target > 0 ? Math.min(1, before / goal.target) : 0;
}

/** The goal track (trim-ui §13 Goals: 8pt, green). */
const TRACK = spacing.sm;

/**
 * A goal this workout reached (trim-ui §13 Done): 🎯 `Bench Press goal reached` with `100 kg`,
 * over a green track that fills from where it stood to the end with the pop once Done lands.
 * Rare, so it gets motion. Reduce Motion: the track fills without the overshoot.
 */
function GoalReached({
  goal,
  from,
  units,
  landed,
}: {
  goal: Goal;
  from: number;
  units: 'kg' | 'lbs';
  landed: boolean;
}) {
  const { colors, type } = useTheme();
  const reduceMotion = useReducedMotion();
  const fill = useSharedValue(from);

  useEffect(() => {
    if (!landed) {
      return;
    }
    fill.set(
      reduceMotion
        ? withTiming(1, { duration: DURATION.change, easing: EASE_OUT, reduceMotion: ReduceMotion.Never })
        : withSpring(1, SPRING.pop),
    );
  }, [fill, landed, reduceMotion]);

  // The track clips the overshoot, so the pop reads as the fill landing hard at the end.
  const fillStyle = useAnimatedStyle(() => ({ width: `${Math.max(0, fill.get()) * 100}%` }));
  const target = `${Math.round(goal.target * 10) / 10} ${units}`;

  return (
    <View
      accessible
      accessibilityLabel={`${goal.exerciseName} goal reached, ${target}`}
      testID="done-goal-reached"
      style={{ gap: space.related }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.related }}>
        <SymbolView name="scope" size={iconSize.row} weight="medium" tintColor={colors.systemGreen} />
        <Text style={[type.row, { flex: 1 }]} numberOfLines={2}>
          {`${goal.exerciseName} goal reached`}
        </Text>
        <Text style={[type.row, { fontVariant: ['tabular-nums'] }]}>{target}</Text>
      </View>
      <View
        style={{ height: TRACK, borderRadius: radius.full, backgroundColor: colors.systemGray5, overflow: 'hidden' }}>
        <Animated.View
          style={[{ height: TRACK, borderRadius: radius.full, backgroundColor: colors.systemGreen }, fillStyle]}
        />
      </View>
    </View>
  );
}

/**
 * `4 × 6`: the plan's prescription for this lift when the workout was a day of the active
 * plan, else what was logged (sets × the heaviest set's reps).
 */
function doneMetric(
  exercise: LoggedExercise,
  workout: LoggedWorkout,
  plan: WorkoutPlan | null | undefined,
): string {
  const key = normalizedStatsKey(exercise.exerciseName);
  const day = plan?.days.find((item) => item.id === workout.dayId);
  const prescription = day?.exercises.find((item) => normalizedStatsKey(item.name) === key);
  if (prescription) {
    return formatPlanMetricShort(prescription);
  }
  const top = exercise.sets.reduce<LoggedExercise['sets'][number] | null>(
    (best, set) => ((set.weight ?? 0) > (best?.weight ?? -1) ? set : best),
    null,
  );
  return top?.reps != null ? `${exercise.sets.length} × ${top.reps}` : `${exercise.sets.length} sets`;
}

/**
 * The tick: a green circle that pops in (`SPRING.pop`, 0.5 → 1) as the modal lands, its check
 * drawing itself (stroke 0 → 1, `change`). Finish already gave the success haptic, so it has
 * none of its own. Reduce Motion: it fades in with the check drawn.
 */
function DoneTick({ landed }: { landed: boolean }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const shown = useSharedValue(0);
  const scale = useSharedValue(reduceMotion ? 1 : 0.5);
  const drawn = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (!landed) {
      return;
    }
    shown.set(
      withTiming(1, {
        duration: reduceMotion ? DURATION.change : DURATION.fade,
        easing: EASE_OUT,
        reduceMotion: ReduceMotion.Never,
      }),
    );
    if (reduceMotion) {
      return;
    }
    scale.set(withSpring(1, SPRING.pop));
    drawn.set(withTiming(1, { duration: DURATION.change, easing: EASE_OUT }));
  }, [drawn, landed, reduceMotion, scale, shown]);

  const circle = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ scale: scale.get() }],
  }));
  const check = useAnimatedProps(() => ({
    strokeDashoffset: CHECK_LENGTH * (1 - drawn.get()),
  }));

  return (
    <Animated.View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Done"
      testID="done-tick"
      style={[
        {
          width: TICK,
          height: TICK,
          borderRadius: radius.full,
          backgroundColor: colors.systemGreen,
          alignItems: 'center',
          justifyContent: 'center',
        },
        circle,
      ]}>
      <Svg width={CHECK} height={CHECK} viewBox="0 0 17 17">
        <AnimatedPath
          d={CHECK_PATH}
          fill="none"
          stroke={colors.onGreen}
          strokeWidth={CHECK_STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={[CHECK_LENGTH, CHECK_LENGTH]}
          animatedProps={check}
        />
      </Svg>
    </Animated.View>
  );
}

/**
 * `First workout`, or `10th workout` with its number rolling up from 9 once Done lands
 * (trim-ui → Moments → Milestones). Stated in `label` ink: the rare fact outranks the day line
 * by tier, not size (trim-ui §3 rule 10).
 */
function MilestoneFact({ milestone, landed }: { milestone: string; landed: boolean }) {
  const { colors, type } = useTheme();
  const count = Number.parseInt(milestone, 10);
  const style = [type.caption, { color: colors.label, fontVariant: ['tabular-nums' as const] }];
  if (!Number.isFinite(count)) {
    return (
      <Text style={style} testID="done-milestone">
        {milestone}
      </Text>
    );
  }
  const suffix = `${ordinal(count).slice(String(count).length)} workout`;
  return (
    <View accessible accessibilityLabel={milestone} testID="done-milestone">
      <StaggerValue value={landed ? count : count - 1} suffix={suffix} style={style} />
    </View>
  );
}
