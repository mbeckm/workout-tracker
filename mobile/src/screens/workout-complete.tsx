import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { enterUp } from '@/motion';
import { useTheme } from '@/theme/theme-context';
import { formatLoggedSetLine, formatPaperMinutes } from '@/domain/helpers';
import { unlockPro } from '@/purchases/purchases';
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
  const { workoutHistory, lastCompletedWorkout, shouldOfferPaywall, setPro, dismissPaywall } =
    useWorkoutStore();
  const presentingPaywall = useRef(false);
  const workout =
    workoutHistory.find((item) => item.id === id) ??
    (lastCompletedWorkout?.id === id ? lastCompletedWorkout : null);

  const done = async () => {
    if (presentingPaywall.current) {
      return;
    }
    if (!shouldOfferPaywall) {
      router.replace('/');
      return;
    }
    presentingPaywall.current = true;
    dismissPaywall();
    let openedInAppPaywall = false;
    const isPro = await unlockPro(() => {
      openedInAppPaywall = true;
      router.replace('/paywall');
    });
    setPro(isPro);
    if (!openedInAppPaywall) {
      router.replace('/');
    }
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
          <Text style={[type.hero, { textAlign: 'left' }]}>Done</Text>
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
        <Animated.View
          entering={enterUp(Boolean(reduceMotion))}
          style={{ gap: 6, paddingBottom: 28 }}>
          <Text style={type.hero}>Done</Text>
          <Text style={type.kicker}>{workout.title}</Text>
          <Text style={type.kicker}>{formatPaperMinutes(workout.durationMinutes)}</Text>
        </Animated.View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
          {workout.exercises.map((exercise) => (
            <View key={exercise.id} style={{ gap: 4, paddingVertical: 8 }}>
              <Text style={type.row}>{exercise.exerciseName}</Text>
              <Text style={type.kicker}>
                {exercise.sets.map((set) => formatLoggedSetLine(set)).join('\n')}
              </Text>
            </View>
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
