import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PaperBack } from '@/components/paper';
import { PrCrown } from '@/components/pr-crown';
import { useTheme } from '@/theme/theme-context';
import {
  formatLoggedSetLine,
  formatSessionFacts,
  personalBestSetIds,
} from '@/domain/helpers';
import { useWorkoutStore } from '@/store/workout-store';

export function HistorySessionScreen() {
  const { colors, type } = useTheme();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { workoutHistory } = useWorkoutStore();
  const workout = workoutHistory.find((item) => item.id === id);
  const prSetIds = useMemo(
    () => (workout ? personalBestSetIds(workout, workoutHistory) : new Set<string>()),
    [workout, workoutHistory],
  );

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
          <PaperBack onPress={() => router.back()} />
        </View>
        <Stack.Screen options={{ headerShown: false, title: 'Session' }} />
      </>
    );
  }

  return (
    <>
      <View
        style={{
          flex: 1,
          backgroundColor: colors.systemBackground,
          paddingTop: insets.top + 16,
          paddingHorizontal: 24,
        }}>
        <PaperBack onPress={() => router.back()} />
        <Text style={type.displayDay}>{workout.title}</Text>
        <Text style={[type.kicker, { paddingTop: 4 }]}>{formatSessionFacts(workout)}</Text>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: 28, paddingBottom: insets.bottom + 24 }}>
          {workout.exercises.map((exercise) => (
            <View key={exercise.id} style={{ gap: 4, paddingVertical: 10 }}>
              <Text style={type.row}>{exercise.exerciseName}</Text>
              {exercise.sets.map((set) => {
                const isPr = prSetIds.has(set.id);
                return (
                  <View
                    key={set.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      minHeight: 20,
                    }}>
                    <Text style={[type.kicker, { fontVariant: ['tabular-nums'] }]}>
                      {formatLoggedSetLine(set)}
                    </Text>
                    {isPr ? <PrCrown size={13} /> : null}
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </View>
      <Stack.Screen options={{ headerShown: false, title: 'Session' }} />
    </>
  );
}
