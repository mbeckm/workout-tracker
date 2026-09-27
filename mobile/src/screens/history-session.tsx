import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EDITOR_ACTIONS_TOP, EditorActionRow } from '@/components/editor-chrome';
import { PaperBack } from '@/components/paper';
import { RecapExercise } from '@/components/recap-exercise';
import { useTheme } from '@/theme/theme-context';
import { formatHistoryWhen, formatSessionFacts } from '@/domain/helpers';
import {
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

  // One facts line; each set row carries its own unit.
  const facts = recapFacts([formatSessionFacts(workout)], null);

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
            {workout.exercises.map((exercise) => (
              <RecapExercise
                key={exercise.id}
                exercise={exercise}
                unit={workoutUsesLoad(workout) ? units : null}
                prSetIds={personalBests?.setIds}
              />
            ))}
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
