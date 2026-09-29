import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { space } from '@/constants/theme';
import { useTheme } from '@/theme/theme-context';
import { estimateDayMinutes, formatEstimateMinutes, spokenEstimateMinutes } from '@/domain/day-facts';
import { formatPlanMetricWithLoad } from '@/domain/helpers';
import type { WorkoutDay } from '@/domain/types';
import { sessionIsFor, useStartDay } from '@/navigation/start-day';
import { useWorkoutStore } from '@/store/workout-store';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * "What is this day" (trim-ui → Per screen → Day preview): the day's name in `title`, one fact
 * under it (the estimated duration), then name + prescription per row, and Start (or Resume)
 * at the thumb. Opens from Home's list and its other days.
 * Rows stay read-only (DP-1): the prescription is already on the row, and last time / best
 * belong in the log where they're actionable.
 */
export function DayPreviewBody({
  day,
  fact,
  actionTitle = 'Start',
  onStart,
}: {
  day: WorkoutDay;
  /** At most one fact under the title, or none. */
  fact?: { text: string; spoken?: string } | null;
  actionTitle?: string;
  onStart: () => void;
}) {
  const { type } = useTheme();
  const { previousLogForExercise, units } = useWorkoutStore();
  const insets = useSafeAreaInsets();
  const count = day.exercises.length;

  return (
    <View
      collapsable={false}
      style={{ paddingHorizontal: space.gutter, paddingTop: space.gutter }}>
      <View style={{ gap: space.tight }}>
        <Text style={type.title} accessibilityRole="header" numberOfLines={2}>
          {day.title}
        </Text>
        {fact ? (
          <Text
            style={[type.caption, { fontVariant: ['tabular-nums'] }]}
            accessibilityLabel={fact.spoken}
            testID="preview-meta">
            {fact.text}
          </Text>
        ) : null}
      </View>
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        style={{ maxHeight: 420 }}
        contentContainerStyle={{
          gap: space.inset,
          paddingTop: space.gutter,
          paddingBottom: space.gutter,
        }}>
        {day.exercises.map((exercise) => (
          // Same row as Home's list, so the sheet and Home read as one voice.
          <View key={exercise.id} style={{ gap: space.pair }}>
            <Text style={type.row} numberOfLines={2}>
              {exercise.name}
            </Text>
            <Text style={[type.caption, { fontVariant: ['tabular-nums'] }]}>
              {formatPlanMetricWithLoad(exercise, previousLogForExercise(exercise.name)?.sets, units)}
            </Text>
          </View>
        ))}
      </ScrollView>
      {count > 0 ? (
        <Button
          title={actionTitle}
          variant="black"
          testID={actionTitle === 'Resume' ? 'preview-resume' : 'preview-start'}
          onPress={onStart}
        />
      ) : null}
      {/* The thumb CTA sits 16 above the safe area (trim-ui → Layout → Thumb zone). */}
      <View style={{ height: insets.bottom + space.inset }} />
    </View>
  );
}

export function DayPreviewScreen() {
  const { colors, type } = useTheme();
  const params = useLocalSearchParams<{ planId?: string | string[]; dayId?: string | string[] }>();
  const planId = firstParam(params.planId);
  const dayId = firstParam(params.dayId);
  const { plans, activePlan, workoutHistory, activeSession } = useWorkoutStore();
  const startDay = useStartDay();
  const plan = plans.find((item) => item.id === planId) ?? activePlan;
  const day = plan?.days.find((item) => item.id === dayId);

  if (!plan || !day) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.systemBackground, padding: space.gutter }}>
        <Text style={type.body}>That day is gone.</Text>
      </View>
    );
  }

  const minutes = estimateDayMinutes(plan, day, workoutHistory);

  return (
    <>
      <DayPreviewBody
        day={day}
        fact={
          minutes != null
            ? { text: formatEstimateMinutes(minutes), spoken: spokenEstimateMinutes(minutes) }
            : null
        }
        actionTitle={sessionIsFor(activeSession, plan.id, day.id) ? 'Resume' : 'Start'}
        onStart={() => startDay(plan, day, { replace: true })}
      />
      <Stack.Screen options={{ headerShown: false, title: day.title }} />
    </>
  );
}
