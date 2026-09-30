import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { Fact, FactRow } from '@/components/fact';
import { LiftRow } from '@/components/lift-row';
import { PaperGrabber } from '@/components/paper';
import { space } from '@/constants/theme';
import { parseDayParam } from '@/domain/dates';
import { formatClockTime, formatDoneWhen } from '@/domain/day-facts';
import { formatPaperMinutes } from '@/domain/helpers';
import {
  heaviestSetLine,
  liftChangeFor,
  liftChanges,
  workoutsOnDay,
  type LiftChange,
} from '@/domain/home-numbers';
import type { LoggedWorkout } from '@/domain/types';
import { useWorkoutStore } from '@/store/workout-store';
import { useTheme } from '@/theme/theme-context';

/** The list scrolls inside the sheet past this share of the screen (the sheet sizes to fit). */
const MAX_LIST_SHARE = 0.75;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * A trained day from Home's week (trim-ui §13 Home): what you did that day, as a record. The
 * workout's name in `title`, when and how long as its fact line, then each exercise as a row:
 * `row` name over its best set in `caption`, and what changed against the session before it
 * trailing (↑ `2.5 kg` in ink, `same`, the crown instead of the ↑ on a record), the same lane
 * as Done's. No tick, no motion, no Done button: it closes by drag.
 *
 * Two workouts that day stack newest first, each with its own title and time, `section` apart.
 * One native `formSheet` child (RNScreens), the list scrolling inside it, as in Day preview.
 */
export function DayWorkoutScreen() {
  const { type } = useTheme();
  const { height } = useWindowDimensions();
  const params = useLocalSearchParams<{ date?: string | string[] }>();
  const day = parseDayParam(firstParam(params.date));
  const dayKey = day?.getTime() ?? null;
  const { workoutHistory } = useWorkoutStore();
  const workouts = useMemo(
    () => (dayKey != null ? workoutsOnDay(workoutHistory, new Date(dayKey)) : []),
    [dayKey, workoutHistory],
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: workouts[0]?.title ?? 'Workout' }} />
      <View collapsable={false} style={{ paddingTop: space.gutter }} testID="day-workout-sheet">
        <PaperGrabber overlay />
        {workouts.length === 0 ? (
          <Text style={[type.caption, { paddingHorizontal: space.gutter, paddingBottom: space.gutter }]}>
            No workout that day
          </Text>
        ) : (
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: height * MAX_LIST_SHARE }}
            contentContainerStyle={{
              gap: space.section,
              paddingHorizontal: space.gutter,
              paddingBottom: space.gutter,
            }}>
            {workouts.map((workout) => (
              <WorkoutRecord
                key={workout.id}
                workout={workout}
                history={workoutHistory}
                withTime={workouts.length > 1}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </>
  );
}

function WorkoutRecord({
  workout,
  history,
  withTime,
}: {
  workout: LoggedWorkout;
  history: LoggedWorkout[];
  /** Two workouts on one day are told apart by the time they finished. */
  withTime: boolean;
}) {
  const { type } = useTheme();
  const { units } = useWorkoutStore();
  const changes = useMemo(() => liftChanges(workout, history), [workout, history]);
  const when = formatDoneWhen(workout.completedAt);
  const whenText = withTime ? `${when}, ${formatClockTime(workout.completedAt)}` : when;
  const minutes = formatPaperMinutes(workout.durationMinutes);
  const exercises = workout.exercises.filter((exercise) => exercise.sets.length > 0);

  return (
    <View testID={`day-workout-${workout.id}`}>
      <View style={{ gap: space.tight }}>
        <Text style={type.title} accessibilityRole="header" numberOfLines={2}>
          {workout.title}
        </Text>
        <View accessible accessibilityLabel={`${whenText}, ${minutes}`}>
          <FactRow>
            <Text style={[type.caption, { fontVariant: ['tabular-nums'] }]}>{whenText}</Text>
            <Fact kind="duration">{minutes}</Fact>
          </FactRow>
        </View>
      </View>
      {/* The rows carry `related` of their own, so the first name sits `gutter` under the facts. */}
      <View style={{ paddingTop: space.inset }}>
        {exercises.map((exercise, index) => (
          <LiftRow
            key={exercise.id}
            name={exercise.exerciseName}
            detail={heaviestSetLine(exercise.sets, units) ?? undefined}
            change={recordChange(liftChangeFor(changes, exercise.exerciseName))}
            units={units}
            showSeparator={index < exercises.length - 1}
            testID={`day-workout-row-${exercise.id}`}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * A first time has nothing to compare with, and its load is already the best set under the
 * name, so the lane stays empty (say each fact once, trim-ui §9).
 */
function recordChange(change: LiftChange | null): LiftChange | null {
  return change && change.kind !== 'first' ? change : null;
}
