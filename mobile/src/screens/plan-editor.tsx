import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EditorActionRow } from '@/components/editor-chrome';
import { LIST_LAYOUT, PrescriptionRow } from '@/components/prescription-row';
import { iconSize, PRESSED_OPACITY, space, TOUCH_TARGET } from '@/constants/theme';
import { emptyDay, withDay } from '@/domain/helpers';
import type { ExercisePrescription, WorkoutDay } from '@/domain/types';
import { largeTitleOptions } from '@/navigation/large-title';
import { confirmPlanCreated } from '@/navigation/plan-created';
import { requirePro } from '@/purchases/pro-gate';
import { useUndoableDeletes } from '@/store/undoable-deletes';
import { useWorkoutStore } from '@/store/workout-store';
import { useTheme } from '@/theme/theme-context';

/**
 * Plan detail v3 (trim-ui §13 Plan detail; PRODUCT-DECISIONS 70). The plan reads top to bottom
 * like the document it is: each day as a header over its exercises (single-line rows with the
 * prescription in the trailing lane, tapped open to edit Sets / Reps in place) and its own
 * `Add exercise` in the brand hue, where the eye already is; `Add day` closes the list. Controls
 * never mix: the plan's live in the navigation bar's `…` menu, a day's behind the `…` on its
 * header (the name sheet). Nothing asks for a name on the way in.
 */
export function PlanEditorScreen() {
  const { colors, type } = useTheme();
  const params = useLocalSearchParams<{ id: string; new?: string; day?: string }>();
  const id = params.id;
  // PE-2: opened to create a plan (Plans +, Home's Create plan, onboarding's Build my own),
  // so it gets a visible way out once it has work in it, and leaving confirms the plan.
  const isNew = params.new === '1';
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const reduceMotion = Boolean(useReducedMotion());
  const { plans, activePlanId, updatePlan, activatePlan, deletePlan, isPro } = useWorkoutStore();
  const { removePlan, removeExercise: removeExerciseWithUndo } = useUndoableDeletes();
  const plan = plans.find((item) => item.id === id);
  const planRef = useRef(plan);
  const deletedRef = useRef(false);
  const [openedUnnamed] = useState(() => plan != null && !plan.name.trim());
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    planRef.current = plan;
  }, [plan]);

  useEffect(() => {
    return navigation.addListener('beforeRemove', () => {
      const current = planRef.current;
      if (current == null || deletedRef.current) {
        return;
      }
      const hasWork = current.days.some((day) => day.exercises.length > 0);
      if (openedUnnamed && !current.name.trim() && !hasWork) {
        deletePlan(current, { archive: false });
        return;
      }
      // Done, Back and the edge swipe all keep a new plan with work in it, so all of them
      // confirm it. Only a plan that isn't active lands on Plans, where its row lights up.
      if (isNew && hasWork) {
        confirmPlanCreated(current.id, { reveal: current.id !== activePlanId });
      }
    });
  }, [activePlanId, deletePlan, isNew, navigation, openedUnnamed]);

  if (!plan) {
    return <View style={{ flex: 1, backgroundColor: colors.systemBackground }} />;
  }

  const collapseEditor = () => {
    Keyboard.dismiss();
    setEditingId(null);
  };

  const openPicker = (day: WorkoutDay) => {
    collapseEditor();
    router.push(
      `/exercises?planId=${plan.id}&dayId=${day.id}&dayTitle=${encodeURIComponent(day.title)}&from=plan`,
    );
  };

  const openDay = (day: WorkoutDay) => {
    collapseEditor();
    router.push(`/edit?planId=${plan.id}&dayId=${day.id}`);
  };

  const renamePlan = () => {
    collapseEditor();
    router.push(`/edit?planId=${plan.id}&focus=1`);
  };

  const addDay = () => {
    collapseEditor();
    const added = emptyDay(`Day ${plan.days.length + 1}`);
    updatePlan({ ...plan, days: [...plan.days, added], daysPerWeek: plan.days.length + 1 });
  };

  const updateExercise = (dayId: string, exerciseId: string, patch: Partial<ExercisePrescription>) => {
    const latest = planRef.current ?? plan;
    updatePlan(
      withDay(latest, dayId, (current) => ({
        ...current,
        exercises: current.exercises.map((exercise) =>
          exercise.id === exerciseId ? { ...exercise, ...patch } : exercise,
        ),
      })),
    );
  };

  const moveExercise = (dayId: string, exerciseId: string, delta: -1 | 1) => {
    updatePlan(
      withDay(plan, dayId, (current) => {
        const index = current.exercises.findIndex((item) => item.id === exerciseId);
        const to = index + delta;
        if (index < 0 || to < 0 || to >= current.exercises.length) {
          return current;
        }
        const exercises = [...current.exercises];
        [exercises[index], exercises[to]] = [exercises[to], exercises[index]];
        return { ...current, exercises };
      }),
    );
  };

  const removeExercise = (dayId: string, exerciseId: string) => {
    setEditingId((current) => (current === exerciseId ? null : current));
    removeExerciseWithUndo(plan, dayId, exerciseId);
  };

  const named = plan.name.trim().length > 0;
  const isActive = plan.id === activePlanId;
  const hasExercises = plan.days.some((item) => item.exercises.length > 0);

  const finish = () => {
    // No haptic (trim-ui §8 Haptics): the toast (and the Plans row) follow from
    // `beforeRemove` once the editor leaves.
    // The plan Home shows: land there, ready to press Start. Another plan: back to Plans.
    if (plan.id === activePlanId) {
      router.dismissTo('/');
    } else {
      router.back();
    }
  };

  return (
    <>
      {/* The ScrollView is the screen's first view, not wrapped, so the native large title
          finds it and collapses into the bar on scroll. */}
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.systemBackground }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={collapseEditor}
        automaticallyAdjustKeyboardInsets
        // Content shares the title's leading edge (trim-ui §4 Under a large title).
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: space.margin,
          paddingBottom: insets.bottom + space.gutter,
        }}>
        <Pressable accessible={false} onPress={collapseEditor} style={{ flexGrow: 1 }}>
          {isActive ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.tight }}>
              <SymbolView name="checkmark" tintColor={colors.systemGreen} size={iconSize.caption} weight="medium" />
              <Text style={[type.caption, { color: colors.systemGreen }]}>Active</Text>
            </View>
          ) : null}

          {plan.days.map((day, dayIndex) => (
            <Fragment key={day.id}>
              <Animated.View
                layout={reduceMotion ? undefined : LIST_LAYOUT}
                style={{ paddingTop: dayIndex === 0 && !isActive ? space.inset : space.section }}
                testID={`plan-day-${dayIndex}`}>
                <DayHeader
                  title={day.title.trim() || `Day ${dayIndex + 1}`}
                  onMore={() => openDay(day)}
                  testID={`plan-day-${dayIndex}-more`}
                />
                {day.exercises.map((exercise, index) => (
                  <PrescriptionRow
                    key={exercise.id}
                    exercise={exercise}
                    expanded={exercise.id === editingId}
                    reduceMotion={reduceMotion}
                    showSeparator
                    testID={`plan-day-${dayIndex}-exercise-${index}`}
                    onToggle={() => {
                      if (editingId != null) {
                        collapseEditor();
                        return;
                      }
                      setEditingId(exercise.id);
                    }}
                    onChange={(patch) => updateExercise(day.id, exercise.id, patch)}
                    onMoveUp={index > 0 ? () => moveExercise(day.id, exercise.id, -1) : undefined}
                    onMoveDown={
                      index < day.exercises.length - 1
                        ? () => moveExercise(day.id, exercise.id, 1)
                        : undefined
                    }
                    onRemove={() => removeExercise(day.id, exercise.id)}
                  />
                ))}
                <EditorActionRow
                  title={day.exercises.length === 0 ? 'Add exercises' : 'Add exercise'}
                  symbol="plus"
                  tone="brand"
                  onPress={() => openPicker(day)}
                  testID={`plan-day-${dayIndex}-add`}
                />
              </Animated.View>
            </Fragment>
          ))}

          <Animated.View layout={reduceMotion ? undefined : LIST_LAYOUT} style={{ paddingTop: space.section }}>
            <EditorActionRow title="Add day" symbol="plus" onPress={addDay} testID="plan-add-day" />
          </Animated.View>
        </Pressable>
      </ScrollView>

      {/* The plan's own controls, apart from the days': the bar's `…` menu. */}
      <Stack.Toolbar placement="right">
        {isNew && hasExercises ? (
          <Stack.Toolbar.Button variant="prominent" onPress={finish}>
            Done
          </Stack.Toolbar.Button>
        ) : null}
        <Stack.Toolbar.Menu icon="ellipsis" accessibilityLabel="Plan options">
          <Stack.Toolbar.MenuAction icon="pencil" onPress={renamePlan}>
            {named ? 'Rename plan' : 'Name plan'}
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            icon="checkmark.circle"
            hidden={isActive}
            onPress={async () => {
              if (await requirePro('switch_plan')) {
                activatePlan(plan);
              }
            }}>
            {isPro ? 'Use this plan' : 'Use this plan (Pro)'}
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            icon="trash"
            destructive
            hidden={!hasExercises}
            onPress={() => {
              // Leaving by Delete must not confirm the plan it just removed.
              deletedRef.current = true;
              removePlan(plan);
              router.back();
            }}>
            Delete plan
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
      <Stack.Screen
        options={{
          ...largeTitleOptions(colors, named ? plan.name.trim() : 'New plan'),
          headerBackTitle: 'Plans',
        }}
      />
    </>
  );
}

/**
 * A day's header: its name in `title`, and a trailing `…` that opens the day's sheet (name,
 * Duplicate, Move, Remove). The whole row opens it too.
 */
function DayHeader({ title, onMore, testID }: { title: string; onMore: () => void; testID: string }) {
  const { colors, type } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint="Rename, duplicate, move or remove this day"
      onPress={onMore}
      testID={testID}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.inline,
        minHeight: TOUCH_TARGET,
        opacity: pressed ? PRESSED_OPACITY : 1,
      })}>
      <Text style={[type.title, { flex: 1 }]} numberOfLines={2} accessibilityRole="header">
        {title}
      </Text>
      <SymbolView name="ellipsis" size={iconSize.row} weight="semibold" tintColor={colors.secondaryLabel} />
    </Pressable>
  );
}
