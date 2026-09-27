import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedSheet } from '@/components/animated-sheet';
import { Button } from '@/components/button';
import { useTheme } from '@/theme/theme-context';
import { estimateDayMinutes, formatDoneLabel, formatExerciseCount, lastDoneAt } from '@/domain/day-facts';
import { formatPlanMetricWithLoad } from '@/domain/helpers';
import type { LoggedWorkout, WorkoutDay, WorkoutPlan } from '@/domain/types';
import { sessionIsFor, useStartDay } from '@/navigation/start-day';
import { useWorkoutStore } from '@/store/workout-store';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * "What is this day": name + prescription per row, then Start (or Resume).
 * Rows stay read-only (DP-1): the prescription is already on the row, and last time / best
 * belong in the log where they're actionable. A tap target per row would be a hidden
 * affordance on a sheet whose one job is Start.
 */
export function DayPreviewBody({
  day,
  meta,
  actionTitle = 'Start',
  onStart,
}: {
  day: WorkoutDay;
  meta: string;
  actionTitle?: string;
  onStart: () => void;
}) {
  const { colors, type } = useTheme();
  const { previousLogForExercise, units } = useWorkoutStore();
  const insets = useSafeAreaInsets();
  const count = day.exercises.length;

  return (
    <>
      <View style={{ gap: 4, paddingBottom: 12 }}>
        <Text style={type.title} numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {day.title}
        </Text>
        <Text style={[type.kicker, { color: colors.tertiaryLabel }]} testID="preview-meta">
          {meta}
        </Text>
      </View>
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        style={{ maxHeight: 420 }}
        contentContainerStyle={{ paddingBottom: 20 }}>
        {day.exercises.map((exercise) => (
          // Read-only rows: the exercise sheet they used to open only held media.
          <View key={exercise.id} style={{ gap: 2, paddingVertical: 12 }}>
            <Text style={type.row} numberOfLines={1}>
              {exercise.name}
            </Text>
            <Text style={[type.kicker, { color: colors.tertiaryLabel, fontVariant: ['tabular-nums'] }]}>
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
      <View style={{ height: Math.max(insets.bottom, 10) }} />
    </>
  );
}

/** DP-2: `6 exercises · ~48 min · Done Thu 17`. */
function previewMeta(plan: WorkoutPlan, day: WorkoutDay, history: LoggedWorkout[]): string {
  const minutes = estimateDayMinutes(plan, day, history);
  const doneAt = lastDoneAt(plan, day.id, history);
  return [
    formatExerciseCount(day.exercises.length),
    minutes != null ? `~${minutes} min` : '',
    doneAt ? formatDoneLabel(doneAt) : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

export function DayPreviewScreen() {
  const { colors, type } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ planId?: string | string[]; dayId?: string | string[] }>();
  const planId = firstParam(params.planId);
  const dayId = firstParam(params.dayId);
  const { plans, activePlan, workoutHistory, activeSession } = useWorkoutStore();
  const startDay = useStartDay();
  const plan = plans.find((item) => item.id === planId) ?? activePlan;
  const day = plan?.days.find((item) => item.id === dayId);

  if (!plan || !day) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.systemBackground, padding: 24 }}>
        <Text style={type.body}>That day is gone.</Text>
      </View>
    );
  }

  return (
    <>
      <AnimatedSheet hosted visible onClose={() => router.back()} dragFrom="sheet">
        <DayPreviewBody
          day={day}
          meta={previewMeta(plan, day, workoutHistory)}
          actionTitle={sessionIsFor(activeSession, plan.id, day.id) ? 'Resume' : 'Start'}
          onStart={() => startDay(plan, day, { replace: true })}
        />
      </AnimatedSheet>
      <Stack.Screen options={{ headerShown: false, title: day.title }} />
    </>
  );
}
