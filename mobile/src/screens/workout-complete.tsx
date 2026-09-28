import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { RecapExercise } from '@/components/recap-exercise';
import { fontScaleCap, space } from '@/constants/theme';
import { workoutPersonalBests, workoutUsesLoad } from '@/domain/set-lines';
import { enterUp } from '@/motion';
import { useTheme } from '@/theme/theme-context';
import { formatPaperMinutes, workoutMilestone } from '@/domain/helpers';
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

  // One line in words (trim-ui → Done): the day and how long. The recap below shows the rest.
  const facts = `${workout.title}, ${formatPaperMinutes(workout.durationMinutes)}`;
  const milestone = workoutMilestone(workout, workoutHistory);

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
          {/* Plain View owns layout so the entering animation can't collapse the header's height. */}
          <View style={{ paddingBottom: space.section }}>
            <Animated.View entering={enterUp(Boolean(reduceMotion))} style={{ gap: space.related }}>
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
                {milestone ? (
                  <Text style={type.caption} testID="done-milestone">
                    {milestone}
                  </Text>
                ) : null}
              </View>
            </Animated.View>
          </View>
          <View style={{ gap: space.section }}>
            {workout.exercises.map((exercise) => (
              <RecapExercise
                key={exercise.id}
                exercise={exercise}
                unit={workoutUsesLoad(workout) ? units : null}
                prSetIds={personalBests?.setIds}
                testID={`done-recap-${exercise.id}`}
              />
            ))}
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
