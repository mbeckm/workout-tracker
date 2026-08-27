import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedSheet } from '@/components/animated-sheet';
import { Button } from '@/components/button';
import { ExerciseThumb } from '@/components/exercise-thumb';
import { exerciseStillMediaURL } from '@/catalog';
import { useTheme } from '@/theme/theme-context';
import { formatPlanMetric } from '@/domain/helpers';
import type { WorkoutDay } from '@/domain/types';
import { useWorkoutStore } from '@/store/workout-store';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function DayPreviewBody({
  day,
  onStart,
  onOpenExercise,
}: {
  day: WorkoutDay;
  onStart: () => void;
  onOpenExercise: (exerciseId: string) => void;
}) {
  const { colors, type } = useTheme();
  const insets = useSafeAreaInsets();
  const count = day.exercises.length;
  const meta = `${count} ${count === 1 ? 'exercise' : 'exercises'}`;

  return (
    <>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          paddingBottom: 12,
        }}>
        <Text style={[type.title, { flexShrink: 1 }]} numberOfLines={1}>
          {day.title}
        </Text>
        <Text style={type.kicker}>{meta}</Text>
      </View>
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        style={{ maxHeight: 420 }}
        contentContainerStyle={{ paddingBottom: 20 }}>
        {day.exercises.map((exercise) => (
          <Pressable
            key={exercise.id}
            accessibilityRole="button"
            onPress={() => onOpenExercise(exercise.id)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 12,
              opacity: pressed ? 0.7 : 1,
            })}>
            <ExerciseThumb
              uri={exerciseStillMediaURL(exercise)}
              name={exercise.name}
              size={44}
              animated={false}
              backgroundColor={colors.systemGray5}
            />
            <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
              <Text style={type.row} numberOfLines={1}>
                {exercise.name}
              </Text>
              <Text style={type.kicker}>{formatPlanMetric(exercise)}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
      {count > 0 ? (
        <Button title="Start" variant="black" testID="preview-start" onPress={onStart} />
      ) : null}
      <View style={{ height: Math.max(insets.bottom, 10) }} />
    </>
  );
}

export function DayPreviewScreen() {
  const { colors, type } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ planId?: string | string[]; dayId?: string | string[] }>();
  const planId = firstParam(params.planId);
  const dayId = firstParam(params.dayId);
  const { plans, activePlan } = useWorkoutStore();
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
          onStart={() => {
            const firstExerciseId = day.exercises[0]?.id;
            router.replace(
              `/log?planId=${plan.id}&dayId=${day.id}${
                firstExerciseId ? `&exerciseId=${encodeURIComponent(firstExerciseId)}` : ''
              }`,
            );
          }}
          onOpenExercise={(exerciseId) =>
            router.push({
              pathname: '/exercise-sheet',
              params: { planId: plan.id, dayId: day.id, exerciseId },
            })
          }
        />
      </AnimatedSheet>
      <Stack.Screen options={{ headerShown: false, title: day.title }} />
    </>
  );
}
