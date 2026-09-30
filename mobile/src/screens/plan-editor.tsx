import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { DayChips } from '@/components/day-chips';
import { EDITOR_ACTIONS_TOP, EditorActionRow } from '@/components/editor-chrome';
import { LIST_LAYOUT, PrescriptionRow } from '@/components/prescription-row';
import { iconSize, space, TOUCH_TARGET } from '@/constants/theme';
import { clonePrescription, emptyDay, withDay } from '@/domain/helpers';
import { newId, type ExercisePrescription, type WorkoutDay } from '@/domain/types';
import { DURATION } from '@/motion';
import { largeTitleOptions } from '@/navigation/large-title';
import { confirmPlanCreated } from '@/navigation/plan-created';
import { promptRename } from '@/navigation/rename-prompt';
import { requirePro } from '@/purchases/pro-gate';
import { useUndoableDeletes } from '@/store/undoable-deletes';
import { useWorkoutStore } from '@/store/workout-store';
import { useTheme } from '@/theme/theme-context';

/**
 * Plan detail v2 (trim-ui §13 Plan detail; PRODUCT-DECISIONS 69): the whole plan on one page,
 * built like Home. The plan's name is the native large title; the days are Home's chips, with a
 * `+` chip that adds one; under them the selected day's exercises as single-line rows with the
 * prescription in the trailing lane, tapped open to edit Sets / Reps in place. The selected
 * day's actions, then the plan's, follow as quiet rows. An empty day's `Add exercises` and a new
 * plan's `Done` sit at the thumb.
 */
export function PlanEditorScreen() {
  const { colors, scheme, type } = useTheme();
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
  const {
    removePlan,
    removeDay: removeDayWithUndo,
    removeExercise: removeExerciseWithUndo,
  } = useUndoableDeletes();
  const plan = plans.find((item) => item.id === id);
  const planRef = useRef(plan);
  const deletedRef = useRef(false);
  const [openedUnnamed] = useState(() => plan != null && !plan.name.trim());

  // The selected day: the one the editor was opened on (`day`), else the first. A removed day
  // hands the selection to its neighbour.
  const [selection, setSelection] = useState<{ id: string | null; index: number }>({
    id: params.day ?? null,
    index: 0,
  });
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

  // Plan and day names are native titles or chips, renamed the same way: the system prompt
  // (`promptRename`, trim-ui §10 Rename).
  const renamePlan = () => {
    const current = planRef.current;
    if (!current) {
      return;
    }
    promptRename({
      title: current.name.trim() ? 'Rename plan' : 'Name this plan',
      current: current.name,
      scheme,
      onSave: (name) => {
        const latest = planRef.current;
        if (latest) {
          updatePlan({ ...latest, name });
        }
      },
    });
  };

  // A new plan asks for its name once it has slid in.
  useEffect(() => {
    if (!openedUnnamed) {
      return;
    }
    let asked = false;
    return navigation.addListener('transitionEnd' as never, (event: { data?: { closing?: boolean } }) => {
      if (!asked && !event.data?.closing) {
        asked = true;
        renamePlan();
      }
    });
    // Once per visit: renamePlan reads the latest plan through planRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, openedUnnamed]);

  if (!plan) {
    return <View style={{ flex: 1, backgroundColor: colors.systemBackground }} />;
  }

  const days = plan.days;
  const foundIndex = days.findIndex((item) => item.id === selection.id);
  const selectedIndex =
    foundIndex >= 0 ? foundIndex : Math.min(selection.index, Math.max(0, days.length - 1));
  const day = days[selectedIndex];

  const collapseEditor = () => {
    Keyboard.dismiss();
    setEditingId(null);
  };

  const selectDay = (index: number) => {
    collapseEditor();
    const next = days[index];
    if (next) {
      setSelection({ id: next.id, index });
    }
  };

  const openPicker = (target: WorkoutDay) => {
    collapseEditor();
    router.push(
      `/exercises?planId=${plan.id}&dayId=${target.id}&dayTitle=${encodeURIComponent(target.title)}&from=plan`,
    );
  };

  const addDay = () => {
    collapseEditor();
    const added = emptyDay(`Day ${days.length + 1}`);
    updatePlan({ ...plan, days: [...days, added], daysPerWeek: days.length + 1 });
    setSelection({ id: added.id, index: days.length });
  };

  const renameDay = (target: WorkoutDay) => {
    collapseEditor();
    promptRename({
      title: 'Rename day',
      current: target.title,
      scheme,
      onSave: (title) => {
        const latest = planRef.current;
        if (latest) {
          updatePlan(withDay(latest, target.id, (current) => ({ ...current, title })));
        }
      },
    });
  };

  const duplicateDay = (target: WorkoutDay) => {
    collapseEditor();
    const index = days.findIndex((item) => item.id === target.id);
    const copy: WorkoutDay = {
      id: newId(),
      title: `${target.title.trim() || 'Day'} copy`,
      exercises: target.exercises.map(clonePrescription),
    };
    const next = [...days.slice(0, index + 1), copy, ...days.slice(index + 1)];
    updatePlan({ ...plan, days: next, daysPerWeek: next.length });
    setSelection({ id: copy.id, index: index + 1 });
  };

  const moveDay = (target: WorkoutDay, delta: -1 | 1) => {
    collapseEditor();
    const index = days.findIndex((item) => item.id === target.id);
    const to = index + delta;
    if (index < 0 || to < 0 || to >= days.length) {
      return;
    }
    const next = [...days];
    [next[index], next[to]] = [next[to], next[index]];
    updatePlan({ ...plan, days: next });
    setSelection({ id: target.id, index: to });
  };

  const removeDay = (target: WorkoutDay) => {
    collapseEditor();
    if (days.length <= 1) {
      Alert.alert('Keep one day', 'A plan needs at least one training day.');
      return;
    }
    setSelection({ id: null, index: days.findIndex((item) => item.id === target.id) });
    removeDayWithUndo(plan, target.id);
  };

  const updateExercise = (exerciseId: string, patch: Partial<ExercisePrescription>) => {
    const latest = planRef.current ?? plan;
    updatePlan(
      withDay(latest, day.id, (current) => ({
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

  const removeExercise = (exerciseId: string) => {
    setEditingId((current) => (current === exerciseId ? null : current));
    removeExerciseWithUndo(plan, day.id, exerciseId);
  };

  const named = plan.name.trim().length > 0;
  const isActive = plan.id === activePlanId;
  const hasExercises = days.some((item) => item.exercises.length > 0);
  const dayIsEmpty = day != null && day.exercises.length === 0;

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

  // At the thumb: an empty day asks for exercises (as Home does); a new plan with work in it
  // gets its way out. Otherwise the page has no pill.
  const footer = dayIsEmpty
    ? { title: 'Add exercises', testID: 'plan-add-exercises', onPress: () => openPicker(day) }
    : isNew && hasExercises
      ? { title: 'Done', testID: 'plan-done', onPress: finish }
      : null;

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
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: footer ? space.gutter : insets.bottom + space.gutter,
        }}>
        <Pressable accessible={false} onPress={collapseEditor} style={{ flexGrow: 1 }}>
          {/* Content shares the title's leading edge (trim-ui §4 Under a large title). The
              chips run edge to edge and carry the margin themselves, as on Home. */}
          {isActive ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.tight,
                paddingHorizontal: space.margin,
              }}>
              <SymbolView name="checkmark" tintColor={colors.systemGreen} size={iconSize.caption} weight="medium" />
              <Text style={[type.caption, { color: colors.systemGreen }]}>Active</Text>
            </View>
          ) : null}

          <View style={{ paddingTop: isActive ? space.section : space.inset }}>
            <DayChips
              days={days}
              selectedIndex={selectedIndex}
              onSelect={selectDay}
              onAdd={addDay}
              testID="plan-day-chip"
            />
          </View>

          {day ? (
            <Animated.View
              key={day.id}
              entering={FadeIn.duration(DURATION.fade)}
              style={{ paddingTop: space.inline, paddingHorizontal: space.margin }}
              testID="plan-day-exercises">
              {day.exercises.map((exercise, index) => (
                <PrescriptionRow
                  key={exercise.id}
                  exercise={exercise}
                  expanded={exercise.id === editingId}
                  reduceMotion={reduceMotion}
                  showSeparator={index < day.exercises.length - 1}
                  testID={`plan-exercise-${index}`}
                  onToggle={() => {
                    if (editingId != null) {
                      collapseEditor();
                      return;
                    }
                    setEditingId(exercise.id);
                  }}
                  onChange={(patch) => updateExercise(exercise.id, patch)}
                  onMoveUp={index > 0 ? () => moveExercise(exercise.id, -1) : undefined}
                  onMoveDown={
                    index < day.exercises.length - 1 ? () => moveExercise(exercise.id, 1) : undefined
                  }
                  onRemove={() => removeExercise(exercise.id)}
                />
              ))}
              {dayIsEmpty ? null : (
                <Animated.View layout={reduceMotion ? undefined : LIST_LAYOUT}>
                  <EditorActionRow
                    title="Add exercise"
                    symbol="plus"
                    tone="quiet"
                    onPress={() => openPicker(day)}
                    testID="plan-add-exercise"
                  />
                </Animated.View>
              )}

              {/* The selected day's actions: what a chip can't show. */}
              <Animated.View
                layout={reduceMotion ? undefined : LIST_LAYOUT}
                style={{ paddingTop: dayIsEmpty ? 0 : space.section }}>
                <EditorActionRow title="Rename day" symbol="pencil" onPress={() => renameDay(day)} testID="day-rename" />
                {dayIsEmpty ? null : (
                  <EditorActionRow
                    title="Duplicate day"
                    symbol="plus.square.on.square"
                    onPress={() => duplicateDay(day)}
                    testID="day-duplicate"
                  />
                )}
                {selectedIndex > 0 ? (
                  <EditorActionRow title="Move left" symbol="arrow.left" onPress={() => moveDay(day, -1)} />
                ) : null}
                {selectedIndex < days.length - 1 ? (
                  <EditorActionRow title="Move right" symbol="arrow.right" onPress={() => moveDay(day, 1)} />
                ) : null}
                {days.length > 1 ? (
                  <EditorActionRow
                    title="Remove day"
                    symbol="trash"
                    tone="destructive"
                    onPress={() => removeDay(day)}
                    testID="day-remove"
                  />
                ) : null}
              </Animated.View>

              <Animated.View
                layout={reduceMotion ? undefined : LIST_LAYOUT}
                style={{ paddingTop: EDITOR_ACTIONS_TOP }}>
                <EditorActionRow title="Rename plan" symbol="pencil" onPress={renamePlan} testID="plan-rename" />
                {isActive ? null : (
                  <EditorActionRow
                    title={isPro ? 'Use this plan' : 'Use this plan (Pro)'}
                    symbol="checkmark"
                    onPress={async () => {
                      if (await requirePro('switch_plan')) {
                        activatePlan(plan);
                      }
                    }}
                  />
                )}
                {hasExercises ? (
                  <EditorActionRow
                    title="Delete plan"
                    symbol="trash"
                    tone="destructive"
                    onPress={() => {
                      // Leaving by Delete must not confirm the plan it just removed.
                      deletedRef.current = true;
                      removePlan(plan);
                      router.back();
                    }}
                  />
                ) : null}
              </Animated.View>
            </Animated.View>
          ) : null}
        </Pressable>
      </ScrollView>
      {footer ? (
        <View
          style={{
            minHeight: TOUCH_TARGET,
            paddingHorizontal: space.margin,
            paddingTop: space.related,
            paddingBottom: Math.max(insets.bottom, space.inset),
            backgroundColor: colors.systemBackground,
          }}>
          <Button title={footer.title} variant="black" testID={footer.testID} onPress={footer.onPress} />
        </View>
      ) : null}
      <Stack.Screen
        options={{
          ...largeTitleOptions(colors, named ? plan.name.trim() : 'New plan'),
          headerBackTitle: 'Plans',
        }}
      />
    </>
  );
}
