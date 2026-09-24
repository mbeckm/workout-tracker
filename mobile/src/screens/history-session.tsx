import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EDITOR_ACTIONS_TOP, EditorActionRow } from '@/components/editor-chrome';
import { PaperBack } from '@/components/paper';
import { PrCrown } from '@/components/pr-crown';
import { useTheme } from '@/theme/theme-context';
import { formatHistoryWhen, formatLoggedSetLine, formatSessionFacts } from '@/domain/helpers';
import {
  compressSetLines,
  exerciseRecapLabel,
  recapFacts,
  workoutPersonalBests,
  workoutUsesLoad,
} from '@/domain/set-lines';
import type { LoggedWorkout } from '@/domain/types';
import { useWorkoutStore } from '@/store/workout-store';

/** One confirm for every delete path: History menu, VoiceOver action, Session detail row. */
export function confirmDeleteWorkout(workout: LoggedWorkout, onDelete: () => void) {
  Alert.alert(
    'Delete workout?',
    `${workout.title} · ${formatHistoryWhen(workout.completedAt)}. This can’t be undone.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ],
  );
}

export function HistorySessionScreen() {
  const { colors, type } = useTheme();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { workoutHistory, deleteWorkout, units } = useWorkoutStore();
  const workout = workoutHistory.find((item) => item.id === id);
  const personalBests = useMemo(
    () => (workout ? workoutPersonalBests(workout, workoutHistory) : null),
    [workout, workoutHistory],
  );

  const back = <PaperBack label="History" onPress={() => router.back()} />;

  if (!workout) {
    return (
      <>
        <View
          style={{
            flex: 1,
            backgroundColor: colors.systemBackground,
            paddingTop: insets.top + 16,
            paddingHorizontal: 24,
          }}>
          {back}
        </View>
        <Stack.Screen options={{ headerShown: false, title: 'Session' }} />
      </>
    );
  }

  // One facts line; the weight unit appears once here, set lines stay unitless (G-9).
  const facts = recapFacts([formatSessionFacts(workout)], workoutUsesLoad(workout) ? units : null);

  return (
    <>
      <View
        style={{
          flex: 1,
          backgroundColor: colors.systemBackground,
          paddingTop: insets.top + 16,
        }}>
        <View style={{ paddingHorizontal: 24 }}>{back}</View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}>
          <Text style={type.displayDay} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
            {workout.title}
          </Text>
          <Text
            style={[type.kicker, { paddingTop: 4, fontVariant: ['tabular-nums'] }]}
            accessibilityLabel={facts.accessibilityLabel}
            testID="session-facts">
            {facts.text}
          </Text>
          <View style={{ paddingTop: 18 }}>
            {workout.exercises.map((exercise) => {
              const lines = compressSetLines(exercise.sets);
              const prSet = exercise.sets.find((set) => personalBests?.setIds.has(set.id));
              return (
                <View
                  key={exercise.id}
                  accessible
                  accessibilityLabel={exerciseRecapLabel(
                    exercise,
                    lines,
                    prSet ? formatLoggedSetLine(prSet) : null,
                  )}
                  style={{ gap: 2, paddingVertical: 10 }}>
                  <Text style={type.row}>{exercise.exerciseName}</Text>
                  {lines.map((line) => (
                    <View
                      key={line.setIds[0] ?? line.text}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text
                        style={[type.kicker, { flexShrink: 1, fontVariant: ['tabular-nums'] }]}>
                        {line.text}
                      </Text>
                      {line.setIds.some((setId) => personalBests?.setIds.has(setId)) ? (
                        <PrCrown size={13} />
                      ) : null}
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
          <View style={{ paddingTop: EDITOR_ACTIONS_TOP }}>
            <EditorActionRow
              title="Delete workout"
              symbol="trash"
              tone="destructive"
              testID="session-delete"
              onPress={() =>
                confirmDeleteWorkout(workout, () => {
                  router.back();
                  deleteWorkout(workout.id);
                })
              }
            />
          </View>
        </ScrollView>
      </View>
      <Stack.Screen options={{ headerShown: false, title: 'Session' }} />
    </>
  );
}
