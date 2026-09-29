import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { DoneExercise } from '@/components/done-exercise';
import { StaggerValue } from '@/components/stagger-value';
import { WeekProgress, type WeekCelebration } from '@/components/week-progress';
import { fontScaleCap, space } from '@/constants/theme';
import { weekMovedBy } from '@/domain/plan-loop';
import { formatWeekStreak, STREAK_MIN, weekStreak } from '@/domain/weeks';
import { workoutPersonalBests, workoutUsesLoad } from '@/domain/set-lines';
import { useTheme } from '@/theme/theme-context';
import { formatPaperMinutes, ordinal } from '@/domain/helpers';
import { openPaywall } from '@/purchases/pro-gate';
import { useWorkoutStore } from '@/store/workout-store';

/** If the modal's `transitionEnd` never comes (web, a restored screen), land anyway. */
const LAND_FALLBACK_MS = 700;
/** PR crowns land just after the week dot, 70ms apart, the last by 440ms: done within 1.2s. */
const CROWN_START_MS = 160;
const CROWN_STAGGER_MS = 70;
const CROWN_LAST_MS = 440;

/**
 * Done (trim-ui → Per screen → Done). Finishing is a moment, not a report: `Done`, the day and
 * how long, then the week this workout just moved, whose new dot fills with the pop once the
 * modal has landed (and the count rolls). A PR crown lands on its exercise, a milestone's
 * number rolls up. Each exercise is one line; every set lives in History. The green Done is
 * live from the first frame, and nothing here waits on the motion.
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
  const { units, milestoneFor, claimMilestone, activePlan } = useWorkoutStore();
  const milestone = workout ? milestoneFor(workout) : null;
  const workoutId = workout?.id;

  // Shown once ever (trim-ui §12 Moments): the first Done that shows it claims it.
  useEffect(() => {
    if (milestone && workoutId) {
      claimMilestone(milestone, workoutId);
    }
  }, [claimMilestone, milestone, workoutId]);
  const personalBests = useMemo(
    () => (workout ? workoutPersonalBests(workout, workoutHistory) : null),
    [workout, workoutHistory],
  );
  const week = useMemo(
    () => (workout ? weekMovedBy(activePlan, workoutHistory, workout) : null),
    [activePlan, workout, workoutHistory],
  );
  // Full weeks in a row before and after this workout: a week it completes counts up with the
  // dots as Done lands (trim-ui → Moments → Week complete).
  const streak = useMemo(() => {
    if (!workout) {
      return null;
    }
    const others = workoutHistory.filter((item) => item.id !== workout.id);
    return {
      before: weekStreak(activePlan, others),
      after: weekStreak(activePlan, [workout, ...others]),
    };
  }, [activePlan, workout, workoutHistory]);

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

  // One line in words (trim-ui → Done): the day and how long.
  const facts = `${workout.title}, ${formatPaperMinutes(workout.durationMinutes)}`;
  const moved = week != null && week.after > week.before;
  const celebrate: WeekCelebration | null =
    landed && week && moved
      ? { index: week.after - 1, weekDone: week.after >= week.total, key: 1 }
      : null;
  const shownStreak = streak ? (landed ? streak.after : streak.before) : 0;
  const weekLabel = week
    ? `${week.after} of ${week.total} this week` +
      (streak && streak.after >= STREAK_MIN ? `, ${formatWeekStreak(streak.after)}` : '')
    : '';
  const unit = workoutUsesLoad(workout) ? units : null;
  let prIndex = 0;

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
            paddingTop: space.gutter,
            paddingHorizontal: space.gutter,
            paddingBottom: space.gutter,
          }}>
          <View style={{ gap: space.related }}>
            <Text
              style={type.hero}
              accessibilityRole="header"
              maxFontSizeMultiplier={fontScaleCap.display}>
              Done
            </Text>
            <View>
              <Text style={type.caption} testID="done-facts">
                {facts}
              </Text>
              {milestone ? <MilestoneFact milestone={milestone} landed={landed} /> : null}
            </View>
          </View>
          {week ? (
            <View
              style={{ paddingTop: space.pause }}
              accessible
              accessibilityLabel={weekLabel}
              testID="done-week">
              <WeekProgress
                done={landed ? week.after : week.before}
                total={week.total}
                celebrate={celebrate}
                streak={shownStreak}
              />
            </View>
          ) : null}
          <View style={{ paddingTop: week ? space.section : space.pause, gap: space.section }}>
            {workout.exercises.map((exercise) => {
              const pr = exercise.sets.some((set) => personalBests?.setIds.has(set.id));
              const delayMs = pr
                ? Math.min(CROWN_START_MS + prIndex++ * CROWN_STAGGER_MS, CROWN_LAST_MS)
                : 0;
              return (
                <DoneExercise
                  key={exercise.id}
                  exercise={exercise}
                  unit={unit}
                  prSetIds={personalBests?.setIds}
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
