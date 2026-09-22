import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutUp,
  LinearTransition,
  useReducedMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EDITOR_ACTIONS_TOP, EDITOR_LIST_TOP, EditorActionRow } from '@/components/editor-chrome';
import { PaperBack } from '@/components/paper';
import { radius } from '@/constants/theme';
import { EASE_OUT } from '@/motion';
import { useTheme } from '@/theme/theme-context';
import { formatPlanMetric, setCount, withDay } from '@/domain/helpers';
import type { ExercisePrescription } from '@/domain/types';
import { useWorkoutStore } from '@/store/workout-store';

const LIST_LAYOUT = LinearTransition.duration(220).easing(EASE_OUT);

export function DayEditorScreen() {
  const { colors, type } = useTheme();
  const { planId, dayId } = useLocalSearchParams<{ planId: string; dayId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { plans, updatePlan } = useWorkoutStore();
  const plan = plans.find((item) => item.id === planId);
  const day = plan?.days.find((item) => item.id === dayId);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (!plan || !day) {
    return <View style={{ flex: 1, backgroundColor: colors.systemBackground }} />;
  }

  const exerciseCount = day.exercises.length;
  const exerciseMeta = exerciseCount === 1 ? '1 exercise' : `${exerciseCount} exercises`;

  const collapseConfigurator = () => {
    setEditingId(null);
  };

  const collapseEditor = () => {
    Keyboard.dismiss();
    setEditingId(null);
  };

  const toggleExercise = (exerciseId: string) => {
    if (editingId != null) {
      collapseEditor();
      return;
    }
    setEditingId(exerciseId);
  };

  const updateTitle = (title: string) => {
    updatePlan(withDay(plan, day.id, (current) => ({ ...current, title })));
  };

  const updateExercise = (exerciseId: string, patch: Partial<ExercisePrescription>) => {
    updatePlan(
      withDay(plan, day.id, (current) => ({
        ...current,
        exercises: current.exercises.map((exercise) =>
          exercise.id === exerciseId ? { ...exercise, ...patch } : exercise,
        ),
      })),
    );
  };

  const removeExercise = (exerciseId: string) => {
    setEditingId((current) => (current === exerciseId ? null : current));
    updatePlan(
      withDay(plan, day.id, (current) => ({
        ...current,
        exercises: current.exercises.filter((item) => item.id !== exerciseId),
      })),
    );
  };

  const removeDay = () => {
    if (plan.days.length <= 1) {
      Alert.alert('Keep one day', 'A plan needs at least one training day.');
      return;
    }
    Alert.alert('Remove day?', day.title || 'This day', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          updatePlan({
            ...plan,
            days: plan.days.filter((item) => item.id !== day.id),
            daysPerWeek: plan.days.length - 1,
          });
          router.back();
        },
      },
    ]);
  };

  const openExercisePicker = () => {
    collapseEditor();
    router.push(`/exercises?planId=${plan.id}&dayId=${day.id}&from=prescribe`);
  };

  return (
    <>
      <View
        style={{
          flex: 1,
          backgroundColor: colors.systemBackground,
          paddingTop: insets.top + 16,
          paddingHorizontal: 24,
        }}>
        <PaperBack
          onPress={() => {
            collapseEditor();
            router.back();
          }}
        />
        <TextInput
          value={day.title}
          onChangeText={updateTitle}
          onFocus={collapseConfigurator}
          placeholder="Day"
          placeholderTextColor={colors.tertiaryLabel}
          accessibilityLabel="Day name"
          scrollEnabled={false}
          style={[type.displayDay, { padding: 0, margin: 0 }]}
        />
        <Pressable accessible={false} onPress={editingId ? collapseConfigurator : undefined}>
          <Text style={[type.kicker, { color: colors.tertiaryLabel, paddingTop: 4 }]}>
            {exerciseMeta}
          </Text>
        </Pressable>
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={collapseEditor}
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: insets.bottom + 24,
          }}>
          <Pressable
            accessible={false}
            onPress={collapseEditor}
            style={{ flexGrow: 1, paddingTop: EDITOR_LIST_TOP }}>
            {day.exercises.map((exercise, index) => (
              <ExercisePrescribeRow
                key={exercise.id}
                exercise={exercise}
                isFirst={index === 0}
                expanded={exercise.id === editingId}
                reduceMotion={Boolean(reduceMotion)}
                onToggle={() => toggleExercise(exercise.id)}
                onChangeSets={(sets) => updateExercise(exercise.id, { sets, repScheme: null })}
                onChangeReps={(reps) => updateExercise(exercise.id, { reps, repScheme: null })}
                onRemove={() => removeExercise(exercise.id)}
              />
            ))}
            <Animated.View layout={LIST_LAYOUT}>
              <EditorActionRow
                title="Add exercise"
                symbol="plus"
                tone="quiet"
                onPress={openExercisePicker}
                testID="prescribe-add"
              />
            </Animated.View>
            {plan.days.length > 1 ? (
              <Animated.View layout={LIST_LAYOUT} style={{ paddingTop: EDITOR_ACTIONS_TOP }}>
                <EditorActionRow
                  title="Remove day"
                  symbol="trash"
                  tone="destructive"
                  onPress={removeDay}
                />
              </Animated.View>
            ) : null}
          </Pressable>
        </ScrollView>
      </View>
      <Stack.Screen options={{ headerShown: false, title: day.title, keyboardHandlingEnabled: false }} />
    </>
  );
}

function ExercisePrescribeRow({
  exercise,
  isFirst = false,
  expanded,
  reduceMotion,
  onToggle,
  onChangeSets,
  onChangeReps,
  onRemove,
}: {
  exercise: ExercisePrescription;
  isFirst?: boolean;
  expanded: boolean;
  reduceMotion: boolean;
  onToggle: () => void;
  onChangeSets: (sets: number) => void;
  onChangeReps: (reps: number) => void;
  onRemove: () => void;
}) {
  const { colors, type } = useTheme();
  return (
    <Animated.View layout={LIST_LAYOUT}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${exercise.name}, ${formatPlanMetric(exercise)}`}
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={({ pressed }) => ({
          paddingTop: isFirst ? 0 : 14,
          paddingBottom: expanded ? 12 : 14,
          opacity: pressed ? 0.7 : 1,
        })}>
        <View style={{ gap: 2 }}>
          <Text style={type.row} numberOfLines={1}>
            {exercise.name}
          </Text>
          {expanded ? null : (
            <Animated.View
              entering={reduceMotion ? FadeIn.duration(160) : FadeIn.duration(180).easing(EASE_OUT)}
              layout={LIST_LAYOUT}>
              <Text style={[type.kicker, { color: colors.tertiaryLabel }]} numberOfLines={1}>
                {formatPlanMetric(exercise)}
              </Text>
            </Animated.View>
          )}
        </View>
      </Pressable>
      {expanded ? (
        <Animated.View
          entering={
            reduceMotion
              ? FadeIn.duration(160)
              : FadeInDown.duration(200)
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
          layout={LIST_LAYOUT}
          style={{ gap: 12, paddingBottom: 14 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <PrescribeField label="Sets" value={setCount(exercise)} onCommit={onChangeSets} />
            <PrescribeField
              label="Reps"
              value={Math.max(1, exercise.reps || 8)}
              onCommit={onChangeReps}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${exercise.name}`}
            onPress={onRemove}
            style={({ pressed }) => ({ paddingVertical: 4, opacity: pressed ? 0.55 : 1 })}>
            <Text style={[type.kicker, { color: colors.systemRed }]}>Remove</Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

function PrescribeField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
}) {
  const { colors, type } = useTheme();
  const [text, setText] = useState(String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) {
      setText(String(value));
    }
  }, [value]);

  const commit = (raw: string) => {
    const next = Math.min(99, Math.max(1, parseInt(raw, 10) || 1));
    setText(String(next));
    onCommit(next);
  };

  return (
    <View style={{ flex: 1, gap: 8 }}>
      <Text style={type.kicker}>{label}</Text>
      <TextInput
        value={text}
        keyboardType="number-pad"
        selectTextOnFocus
        accessibilityLabel={label}
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={() => {
          focused.current = false;
          commit(text);
        }}
        onChangeText={(next) => {
          const digits = next.replace(/[^0-9]/g, '').slice(0, 2);
          setText(digits);
          const parsed = parseInt(digits, 10);
          if (parsed >= 1 && parsed <= 99) {
            onCommit(parsed);
          }
        }}
        style={{
          height: 44,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          backgroundColor: colors.secondarySystemBackground,
          textAlign: 'center',
          fontSize: 22,
          fontWeight: '600',
          lineHeight: 28,
          color: colors.label,
          fontVariant: ['tabular-nums'],
        }}
      />
    </View>
  );
}
