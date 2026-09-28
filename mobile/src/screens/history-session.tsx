import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import { EDITOR_ACTIONS_TOP, EditorActionRow } from '@/components/editor-chrome';
import { RecapExercise } from '@/components/recap-exercise';
import { space } from '@/constants/theme';
import { formatClockTime } from '@/domain/day-facts';
import { formatPaperMinutes, formatSessionDate, formatSetsCount } from '@/domain/helpers';
import { loggedSetTotal, workoutPersonalBests, workoutUsesLoad } from '@/domain/set-lines';
import type { LoggedWorkout } from '@/domain/types';
import { useTheme } from '@/theme/theme-context';
import { useWorkoutStore } from '@/store/workout-store';

/**
 * One confirm for every delete path: History swipe and menu, VoiceOver action, Session detail
 * row. A completed workout can't come back, so this is an alert, not an Undo (trim-ui → Forgiveness).
 */
export function confirmDeleteWorkout(
  workout: LoggedWorkout,
  onDelete: () => void,
  onCancel?: () => void,
) {
  Alert.alert(
    `Delete “${workout.title}”?`,
    `The workout from ${formatSessionDate(workout.completedAt)} can’t be restored.`,
    [
      { text: 'Cancel', style: 'cancel', onPress: onCancel },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ],
    { cancelable: true, onDismiss: onCancel },
  );
}

/**
 * A record, not a ceremony (trim-ui → Session detail): the workout's name as the native
 * large title, when on one line and how much on the next, then the exercises as on Done.
 */
export function HistorySessionScreen() {
  const { colors, type } = useTheme();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const { workoutHistory, deleteWorkout, units } = useWorkoutStore();
  const workout = workoutHistory.find((item) => item.id === id);
  const personalBests = useMemo(
    () => (workout ? workoutPersonalBests(workout, workoutHistory) : null),
    [workout, workoutHistory],
  );

  // Light and dark are JS-only (theme-context), so the native bar takes its ink from the theme.
  const header = (
    <Stack.Screen
      options={{
        headerShown: true,
        headerLargeTitleEnabled: true,
        headerTransparent: true,
        headerShadowVisible: false,
        headerBackTitle: 'History',
        headerTintColor: colors.label,
        headerTitleStyle: { color: colors.label },
        headerLargeTitleStyle: { color: colors.label },
        title: workout?.title ?? '',
      }}
    />
  );

  if (!workout) {
    return (
      <>
        <View style={{ flex: 1, backgroundColor: colors.systemBackground }} />
        {header}
      </>
    );
  }

  const when = `${formatSessionDate(workout.completedAt)}, ${formatClockTime(workout.completedAt)}`;
  const amount = `${formatPaperMinutes(workout.durationMinutes)}, ${formatSetsCount(loggedSetTotal(workout))}`;

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.systemBackground }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingHorizontal: space.gutter, paddingBottom: space.gutter }}>
        <View testID="session-facts" accessible accessibilityLabel={`${when}, ${amount}`}>
          <Text style={type.caption}>{when}</Text>
          <Text style={type.caption}>{amount}</Text>
        </View>
        <View style={{ paddingTop: space.section, gap: space.section }}>
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
      {header}
    </>
  );
}
