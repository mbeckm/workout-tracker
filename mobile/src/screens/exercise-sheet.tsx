import { Stack, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatPlanMetric } from '@/domain/helpers';
import { useTheme } from '@/theme/theme-context';
import { useWorkoutStore } from '@/store/workout-store';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Not linked from anywhere in 1.0: day-preview rows are read-only (DP-1). Kept as a plain
 * fact sheet (name, muscle · equipment, plan) so re-linking it never shows a media placeholder.
 */
export function ExerciseSheetScreen() {
  const { colors, type } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    planId?: string | string[];
    dayId?: string | string[];
    exerciseId?: string | string[];
  }>();
  const planId = firstParam(params.planId);
  const dayId = firstParam(params.dayId);
  const exerciseId = firstParam(params.exerciseId);
  const { plans, activePlan } = useWorkoutStore();
  const plan = plans.find((item) => item.id === planId) ?? activePlan;
  const day = plan?.days.find((item) => item.id === dayId);
  const exercise = day?.exercises.find((item) => item.id === exerciseId);

  if (!exercise) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.systemBackground, padding: 24 }}>
        <Text style={type.body}>That exercise is gone.</Text>
      </View>
    );
  }

  const muscle = exercise.targetMuscles[0];
  const equipment = exercise.equipments[0];
  const detail = [muscle, equipment].filter(Boolean).join(' · ');

  return (
    <>
      <View
        style={{
          flex: 1,
          backgroundColor: colors.systemBackground,
          paddingHorizontal: 24,
          paddingTop: 8,
          paddingBottom: insets.bottom + 10,
        }}>
        <View style={{ gap: 6, paddingBottom: 16 }}>
          <Text style={type.title}>{exercise.name}</Text>
          {detail ? <Text style={type.kicker}>{detail}</Text> : null}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <Text style={type.body}>Plan</Text>
          <Text style={[type.body, { color: colors.tertiaryLabel, fontVariant: ['tabular-nums'] }]}>
            {formatPlanMetric(exercise)}
          </Text>
        </View>
      </View>
      <Stack.Screen options={{ headerShown: false, title: exercise.name }} />
    </>
  );
}
