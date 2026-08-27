import { SymbolView } from 'expo-symbols';
import { Stack, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutUp,
  LinearTransition,
  useReducedMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ExerciseThumb } from '@/components/exercise-thumb';
import { PaperScreen } from '@/components/paper';
import { exerciseStillMediaURL } from '@/catalog';
import { radius, spacing } from '@/constants/theme';
import { useTheme } from '@/theme/theme-context';
import { durationIsMinutes, emptyPlan, formatPlanMetric, setCount } from '@/domain/helpers';
import { completedPlanDayIdsSince, startOfLocalWeek, trainableDays } from '@/domain/plan-loop';
import type { ExercisePrescription, WorkoutDay } from '@/domain/types';
import { useWorkoutStore } from '@/store/workout-store';

const VISIBLE_EXERCISES = 4;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const LIST_LAYOUT = LinearTransition.duration(220).easing(EASE_OUT);

const factBase = {
  fontSize: 15,
  fontWeight: '400' as const,
  lineHeight: 20,
};

export function WorkoutTab() {
  const { colors, type } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { activePlan, nextDayIndex, savePlan, workoutHistory } = useWorkoutStore();
  const [expandedForDayId, setExpandedForDayId] = useState<string | null>(null);
  const fact = { ...factBase, color: colors.tertiaryLabel };

  const createPlan = () => {
    const plan = emptyPlan();
    savePlan(plan, { activate: true });
    router.push(`/plan/${plan.id}`);
  };

  const openLog = (day: WorkoutDay) => {
    if (!activePlan || day.exercises.length === 0) {
      return;
    }
    const firstExerciseId = day.exercises[0]?.id;
    router.push(
      `/log?planId=${activePlan.id}&dayId=${day.id}${
        firstExerciseId ? `&exerciseId=${encodeURIComponent(firstExerciseId)}` : ''
      }`,
    );
  };

  const openPreview = (day: WorkoutDay) => {
    if (!activePlan) {
      return;
    }
    if (day.exercises.length === 0) {
      router.push(
        `/exercises?planId=${activePlan.id}&dayId=${day.id}&dayTitle=${encodeURIComponent(day.title)}`,
      );
      return;
    }
    router.push({ pathname: '/day-preview', params: { planId: activePlan.id, dayId: day.id } });
  };

  const nextDay = activePlan?.days[nextDayIndex];
  const canStart = nextDay != null && nextDay.exercises.length > 0;
  const overflow = nextDay ? Math.max(0, nextDay.exercises.length - VISIBLE_EXERCISES) : 0;
  const expanded = nextDay != null && expandedForDayId === nextDay.id;
  const head = nextDay ? nextDay.exercises.slice(0, VISIBLE_EXERCISES) : [];
  const tail = nextDay ? nextDay.exercises.slice(VISIBLE_EXERCISES) : [];

  const weekStart = startOfLocalWeek();
  const doneIds = completedPlanDayIdsSince(activePlan, workoutHistory, weekStart);
  const total = activePlan ? trainableDays(activePlan).length : 0;
  const done = Math.min(doneIds.length, total);
  const exerciseCount = nextDay?.exercises.length ?? 0;
  const minutes = nextDay ? estimateDayMinutes(nextDay) : null;
  const meta =
    minutes != null
      ? `${exerciseCount} ${exerciseCount === 1 ? 'exercise' : 'exercises'} · ~${minutes} min`
      : `${exerciseCount} ${exerciseCount === 1 ? 'exercise' : 'exercises'}`;

  return (
    <>
      <PaperScreen contentContainerStyle={{ paddingBottom: insets.bottom + 88 }}>
        {activePlan ? (
          <View>
            <View style={{ gap: 12 }}>
              <Text style={type.planTitle}>Next Workout</Text>
              {nextDay ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${nextDay.title} preview`}
                  testID="home-next-day"
                  onPress={() => openPreview(nextDay)}
                  style={({ pressed }) => ({ gap: 8, opacity: pressed ? 0.7 : 1 })}>
                  <Text style={type.displayDay} numberOfLines={1}>
                    {nextDay.title}
                  </Text>
                  <Text style={fact}>{meta}</Text>
                </Pressable>
              ) : null}
            </View>

            {nextDay && nextDay.exercises.length > 0 ? (
              <Animated.View layout={LIST_LAYOUT} style={{ paddingTop: 28, gap: 20 }}>
                <Animated.View
                  layout={LIST_LAYOUT}
                  style={{
                    backgroundColor: colors.secondarySystemBackground,
                    borderRadius: radius.md,
                    borderCurve: 'continuous',
                    padding: spacing.md,
                    gap: spacing.s,
                    overflow: 'hidden',
                  }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${nextDay.title} preview`}
                    onPress={() => openPreview(nextDay)}
                    style={({ pressed }) => ({ gap: spacing.s, opacity: pressed ? 0.7 : 1 })}>
                    {head.map((exercise, index) => (
                      <ExerciseRow key={`${exercise.id}-${index}`} exercise={exercise} />
                    ))}
                    {expanded
                      ? tail.map((exercise, index) => (
                          <Animated.View
                            key={`${exercise.id}-overflow-${index}`}
                            entering={
                              reduceMotion
                                ? FadeIn.duration(160)
                                : FadeInDown.duration(200)
                                    .delay(index * 28)
                                    .easing(EASE_OUT)
                                    .withInitialValues({
                                      opacity: 0,
                                      transform: [{ translateY: -8 }],
                                    })
                            }
                            exiting={
                              reduceMotion
                                ? FadeOut.duration(140)
                                : FadeOutUp.duration(180).easing(EASE_OUT)
                            }
                            layout={LIST_LAYOUT}>
                            <ExerciseRow exercise={exercise} />
                          </Animated.View>
                        ))
                      : null}
                  </Pressable>
                  {overflow > 0 ? (
                    <Animated.View layout={LIST_LAYOUT}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          expanded
                            ? 'Show less'
                            : `${overflow} more ${overflow === 1 ? 'exercise' : 'exercises'}`
                        }
                        onPress={() => setExpandedForDayId(expanded ? null : nextDay.id)}
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: spacing.s,
                          width: '100%',
                          opacity: pressed ? 0.7 : 1,
                        })}>
                        <StillSlot>
                          <SymbolView
                            name={expanded ? 'chevron.up' : 'plus'}
                            tintColor={colors.tertiaryLabel}
                            size={expanded ? 14 : 18}
                            weight="medium"
                          />
                        </StillSlot>
                        <Text
                          style={[
                            type.row,
                            {
                              flexGrow: 1,
                              flexShrink: 1,
                              minWidth: 0,
                              color: expanded ? colors.tertiaryLabel : colors.label,
                            },
                          ]}
                          numberOfLines={1}>
                          {expanded
                            ? 'Show less'
                            : `${overflow} more ${overflow === 1 ? 'exercise' : 'exercises'}`}
                        </Text>
                        {expanded ? null : (
                          <SymbolView
                            name="chevron.down"
                            tintColor={colors.tertiaryLabel}
                            size={14}
                            weight="medium"
                            style={{ flexShrink: 0 }}
                          />
                        )}
                      </Pressable>
                    </Animated.View>
                  ) : null}
                </Animated.View>
                {canStart ? (
                  <Animated.View layout={LIST_LAYOUT}>
                    <Button title="Start" variant="black" testID="home-start" onPress={() => openLog(nextDay)} />
                  </Animated.View>
                ) : null}
              </Animated.View>
            ) : null}

            {total > 0 ? (
              <Animated.View layout={LIST_LAYOUT} style={{ paddingTop: 40 }}>
                <WeekAmount done={done} total={total} />
              </Animated.View>
            ) : null}
          </View>
        ) : (
          <View style={{ gap: spacing.s, flex: 1 }}>
            <View style={{ gap: spacing.sm }}>
              <Text style={type.display}>Plan</Text>
              <Text style={type.kicker}>Start from a plan</Text>
            </View>
            <Button title="Create plan" variant="black" onPress={createPlan} />
          </View>
        )}
      </PaperScreen>
      <Stack.Screen options={{ headerShown: false, title: 'Workout' }} />
    </>
  );
}

function ExerciseRow({ exercise }: { exercise: ExercisePrescription }) {
  const { colors, type } = useTheme();
  const fact = { ...factBase, color: colors.tertiaryLabel };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s }}>
      <ExerciseThumb
        uri={exerciseStillMediaURL(exercise)}
        name={exercise.name}
        size={44}
        animated={false}
        contentFit="contain"
        backgroundColor={colors.systemGray5}
      />
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
        <Text style={type.row} numberOfLines={1}>
          {exercise.name}
        </Text>
        <Text style={fact}>{formatPlanMetric(exercise)}</Text>
      </View>
    </View>
  );
}

function StillSlot({ children }: { children?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: radius.sm,
        borderCurve: 'continuous',
        backgroundColor: colors.systemGray5,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
      {children}
    </View>
  );
}

function WeekAmount({ done, total }: { done: number; total: number }) {
  const { colors, type } = useTheme();
  const fact = { ...factBase, color: colors.tertiaryLabel };
  return (
    <View style={{ gap: spacing.s, alignItems: 'flex-start' }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
        <Text style={type.title}>
          {done} of {total}
        </Text>
        <Text style={fact}>this week</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {Array.from({ length: total }, (_, index) => (
          <View
            key={index}
            style={{
              width: 10,
              height: 10,
              borderRadius: radius.full,
              flexShrink: 0,
              backgroundColor: index < done ? colors.systemGreen : colors.systemGray5,
            }}
          />
        ))}
      </View>
    </View>
  );
}

function estimateDayMinutes(day: WorkoutDay): number | null {
  if (day.exercises.length === 0) {
    return null;
  }
  const minutes = day.exercises.reduce((sum, exercise) => {
    if (durationIsMinutes(exercise)) {
      return sum + (Math.round((exercise.durationSeconds ?? 0) / 60) || 20);
    }
    return sum + setCount(exercise) * 2.5;
  }, 0);
  return Math.max(1, Math.round(minutes));
}
