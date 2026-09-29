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
import { PRESSED_OPACITY, radius, space, TOUCH_TARGET } from '@/constants/theme';
import { DURATION, EASE_IN_OUT, EASE_OUT, ENTER_OFFSET } from '@/motion';
import { useTheme } from '@/theme/theme-context';
import { formatPlanMetric, withDay } from '@/domain/helpers';
import { prescriptionFields, type PrescriptionField } from '@/domain/prescription-fields';
import type { ExercisePrescription } from '@/domain/types';
import { largeTitleOptions } from '@/navigation/large-title';
import { promptRename } from '@/navigation/rename-prompt';
import { useUndoableDeletes } from '@/store/undoable-deletes';
import { useWorkoutStore } from '@/store/workout-store';

/** Expand / collapse in place (trim-ui §8): `enter`, ease-in-out. */
const LIST_LAYOUT = LinearTransition.duration(DURATION.enter).easing(EASE_IN_OUT);

export function DayEditorScreen() {
  const { colors, scheme, type } = useTheme();
  const { planId, dayId } = useLocalSearchParams<{ planId: string; dayId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { plans, updatePlan } = useWorkoutStore();
  const { removeDay: removeDayWithUndo, removeExercise: removeExerciseWithUndo } = useUndoableDeletes();
  const plan = plans.find((item) => item.id === planId);
  const day = plan?.days.find((item) => item.id === dayId);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Rename saves after the prompt closes; by then a well's blur may have saved a newer plan.
  const planRef = useRef(plan);
  useEffect(() => {
    planRef.current = plan;
  }, [plan]);

  if (!plan || !day) {
    return <View style={{ flex: 1, backgroundColor: colors.systemBackground }} />;
  }

  const exerciseCount = day.exercises.length;
  const exerciseMeta = exerciseCount === 1 ? '1 exercise' : `${exerciseCount} exercises`;
  const lastIndex = exerciseCount - 1;

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

  const moveExercise = (exerciseId: string, delta: -1 | 1) => {
    updatePlan(
      withDay(plan, day.id, (current) => {
        const index = current.exercises.findIndex((item) => item.id === exerciseId);
        const target = index + delta;
        if (index < 0 || target < 0 || target >= current.exercises.length) {
          return current;
        }
        const exercises = [...current.exercises];
        [exercises[index], exercises[target]] = [exercises[target], exercises[index]];
        return { ...current, exercises };
      }),
    );
  };

  const removeExercise = (exerciseId: string) => {
    setEditingId((current) => (current === exerciseId ? null : current));
    removeExerciseWithUndo(plan, day.id, exerciseId);
  };

  const removeDay = () => {
    if (plan.days.length <= 1) {
      Alert.alert('Keep one day', 'A plan needs at least one training day.');
      return;
    }
    removeDayWithUndo(plan, day.id);
    router.back();
  };

  const openExercisePicker = () => {
    collapseEditor();
    router.push(`/exercises?planId=${plan.id}&dayId=${day.id}&from=prescribe`);
  };

  const renameDay = () => {
    collapseEditor();
    promptRename({
      title: 'Rename day',
      current: day.title,
      scheme,
      onSave: (title) => {
        const latest = planRef.current;
        if (latest) {
          updatePlan(withDay(latest, day.id, (current) => ({ ...current, title })));
        }
      },
    });
  };

  return (
    <>
      <View style={{ flex: 1, backgroundColor: colors.systemBackground }}>
        <ScrollView
          style={{ flex: 1 }}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={collapseEditor}
          automaticallyAdjustKeyboardInsets
          // Same page as the plan editor: the day name is the native large title and content
          // sits on its edge (trim-ui → Layout → Under a large title).
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: space.margin,
            paddingBottom: insets.bottom + space.gutter,
          }}>
          <Pressable accessible={false} onPress={collapseEditor} style={{ flexGrow: 1 }}>
            {exerciseCount > 0 ? (
              <Text style={[type.kicker, { color: colors.tertiaryLabel }]}>{exerciseMeta}</Text>
            ) : null}
            {/* Title block → first row text is `section`; a first action row brings its own 16. */}
            <View style={{ paddingTop: exerciseCount > 0 ? EDITOR_LIST_TOP : space.inset }}>
              {day.exercises.map((exercise, index) => (
                <ExercisePrescribeRow
                  key={exercise.id}
                  exercise={exercise}
                  isFirst={index === 0}
                  expanded={exercise.id === editingId}
                  reduceMotion={Boolean(reduceMotion)}
                  onToggle={() => toggleExercise(exercise.id)}
                  onChange={(patch) => updateExercise(exercise.id, patch)}
                  onMoveUp={index > 0 ? () => moveExercise(exercise.id, -1) : undefined}
                  onMoveDown={index < lastIndex ? () => moveExercise(exercise.id, 1) : undefined}
                  onRemove={() => removeExercise(exercise.id)}
                />
              ))}
              <Animated.View layout={reduceMotion ? undefined : LIST_LAYOUT}>
                <EditorActionRow
                  title="Add exercise"
                  symbol="plus"
                  tone="quiet"
                  onPress={openExercisePicker}
                  testID="prescribe-add"
                />
              </Animated.View>
            </View>
            <Animated.View layout={reduceMotion ? undefined : LIST_LAYOUT} style={{ paddingTop: EDITOR_ACTIONS_TOP }}>
              <EditorActionRow title="Rename day" symbol="pencil" onPress={renameDay} testID="day-rename" />
              {plan.days.length > 1 ? (
                <EditorActionRow title="Remove day" symbol="trash" tone="destructive" onPress={removeDay} />
              ) : null}
            </Animated.View>
          </Pressable>
        </ScrollView>
      </View>
      <Stack.Screen
        options={{
          ...largeTitleOptions(colors, day.title.trim() || 'Day'),
          keyboardHandlingEnabled: false,
        }}
      />
    </>
  );
}

function ExercisePrescribeRow({
  exercise,
  isFirst = false,
  expanded,
  reduceMotion,
  onToggle,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  exercise: ExercisePrescription;
  isFirst?: boolean;
  expanded: boolean;
  reduceMotion: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<ExercisePrescription>) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove: () => void;
}) {
  const { colors, type } = useTheme();
  const fields = prescriptionFields(exercise);
  return (
    <Animated.View layout={reduceMotion ? undefined : LIST_LAYOUT}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${exercise.name}, ${formatPlanMetric(exercise)}`}
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={({ pressed }) => ({
          paddingTop: isFirst ? 0 : space.inset,
          paddingBottom: expanded ? space.inline : space.inset,
          opacity: pressed ? PRESSED_OPACITY : 1,
        })}>
        <View style={{ gap: space.pair }}>
          <Text style={type.row} numberOfLines={1}>
            {exercise.name}
          </Text>
          {expanded ? null : (
            <Animated.View
              entering={reduceMotion ? FadeIn.duration(DURATION.fade) : FadeIn.duration(DURATION.enter).easing(EASE_OUT)}
              layout={reduceMotion ? undefined : LIST_LAYOUT}>
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
              ? FadeIn.duration(DURATION.fade)
              : FadeInDown.duration(DURATION.enter)
                  .easing(EASE_OUT)
                  .withInitialValues({
                    opacity: 0,
                    transform: [{ translateY: -ENTER_OFFSET }],
                  })
          }
          exiting={
            reduceMotion
              ? FadeOut.duration(DURATION.fade)
              : FadeOutUp.duration(DURATION.exit).easing(EASE_OUT)
          }
          layout={reduceMotion ? undefined : LIST_LAYOUT}
          style={{ gap: space.inline, paddingBottom: space.inset }}>
          <View style={{ flexDirection: 'row', gap: space.inline }}>
            {fields.map((field) => (
              <PrescribeField
                key={field.key}
                field={field}
                exerciseName={exercise.name}
                onCommit={(value) => onChange(field.patch(value))}
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.gutter }}>
            <RowAction
              title="Remove"
              accessibilityLabel={`Remove ${exercise.name}`}
              color={colors.systemRed}
              onPress={onRemove}
            />
            {onMoveUp ? (
              <RowAction
                title="Move up"
                accessibilityLabel={`Move ${exercise.name} up`}
                color={colors.label}
                onPress={onMoveUp}
              />
            ) : null}
            {onMoveDown ? (
              <RowAction
                title="Move down"
                accessibilityLabel={`Move ${exercise.name} down`}
                color={colors.label}
                onPress={onMoveDown}
              />
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

function RowAction({
  title,
  accessibilityLabel,
  color,
  onPress,
}: {
  title: string;
  accessibilityLabel: string;
  color: string;
  onPress: () => void;
}) {
  const { type } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        justifyContent: 'center',
        opacity: pressed ? PRESSED_OPACITY : 1,
      })}>
      <Text style={[type.kicker, { color }]}>{title}</Text>
    </Pressable>
  );
}

function PrescribeField({
  field,
  exerciseName,
  onCommit,
}: {
  field: PrescriptionField;
  exerciseName: string;
  onCommit: (value: number) => void;
}) {
  const { colors, type } = useTheme();
  const { label, value, min, max } = field;
  const maxDigits = String(max).length;
  const [text, setText] = useState(String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) {
      setText(String(value));
    }
  }, [value]);

  const commit = (raw: string) => {
    const next = Math.min(max, Math.max(min, parseInt(raw, 10) || min));
    setText(String(next));
    onCommit(next);
  };

  return (
    <View style={{ flex: 1, gap: space.related }}>
      <Text style={type.kicker}>{label}</Text>
      <TextInput
        value={text}
        keyboardType="number-pad"
        selectTextOnFocus
        accessibilityLabel={`${exerciseName}, ${field.a11yLabel}`}
        accessibilityHint={`${min} to ${max}`}
        maxFontSizeMultiplier={1.3}
        testID={`prescribe-field-${field.key}`}
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={() => {
          focused.current = false;
          commit(text);
        }}
        onChangeText={(next) => {
          const digits = next.replace(/[^0-9]/g, '').slice(0, maxDigits);
          setText(digits);
          const parsed = parseInt(digits, 10);
          if (parsed >= min && parsed <= max) {
            onCommit(parsed);
          }
        }}
        style={{
          ...type.title,
          // No lineHeight on a TextInput: iOS applies it to typed text but not the placeholder.
          lineHeight: undefined,
          height: TOUCH_TARGET,
          paddingVertical: 0,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          backgroundColor: colors.secondarySystemBackground,
          textAlign: 'center',
          fontVariant: ['tabular-nums'],
        }}
      />
    </View>
  );
}
