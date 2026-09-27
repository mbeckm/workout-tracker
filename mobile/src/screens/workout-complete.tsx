import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { RecapExercise } from '@/components/recap-exercise';
import {
  formatLoggedSetTotal,
  formatPrCount,
  recapFacts,
  workoutPersonalBests,
  workoutUsesLoad,
} from '@/domain/set-lines';
import { enterUp } from '@/motion';
import { useTheme } from '@/theme/theme-context';
import { formatPaperMinutes } from '@/domain/helpers';
import { openPaywall } from '@/purchases/pro-gate';
import { useWorkoutStore } from '@/store/workout-store';

export function WorkoutCompleteScreen() {
  const { colors, type } = useTheme();
  const reduceMotion = useReducedMotion();
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
  const { units } = useWorkoutStore();
  const personalBests = useMemo(
    () => (workout ? workoutPersonalBests(workout, workoutHistory) : null),
    [workout, workoutHistory],
  );

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
            padding: 24,
            justifyContent: 'center',
            gap: 16,
          }}>
          <Text style={[type.hero, { textAlign: 'left' }]} maxFontSizeMultiplier={1.2}>
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

  // Facts line (D-1): day · duration · sets · PRs. Each set row carries its own unit.
  const prCount = personalBests?.count ?? 0;
  const facts = recapFacts(
    [
      workout.title,
      formatPaperMinutes(workout.durationMinutes),
      formatLoggedSetTotal(workout),
      prCount > 0 && formatPrCount(prCount),
    ],
    null,
  );

  return (
    <>
      <View
        style={{
          flex: 1,
          backgroundColor: colors.systemBackground,
          paddingTop: insets.top + 24,
          paddingHorizontal: 24,
          paddingBottom: Math.max(insets.bottom, 12),
        }}>
        {/* Plain View owns layout so the entering animation can't collapse the header's height. */}
        <View style={{ paddingBottom: 20 }}>
          <Animated.View entering={enterUp(Boolean(reduceMotion))} style={{ gap: 6 }}>
            <Text style={type.hero} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
              Done
            </Text>
            <Text
              style={[type.kicker, { fontVariant: ['tabular-nums'] }]}
              testID="done-facts"
              accessibilityLabel={facts.accessibilityLabel}>
              {facts.text}
            </Text>
          </Animated.View>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}>
          {workout.exercises.map((exercise) => (
            <RecapExercise
              key={exercise.id}
              exercise={exercise}
              unit={workoutUsesLoad(workout) ? units : null}
              prSetIds={personalBests?.setIds}
              testID={`done-recap-${exercise.id}`}
            />
          ))}
        </ScrollView>
        <Button
          title="Done"
          variant="green"
          testID="done-cta"
          onPress={() => void done()}
        />
      </View>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false, title: 'Done' }} />
    </>
  );
}
