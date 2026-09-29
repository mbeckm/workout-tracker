import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Alert, Text, View, type AnimatableNumericValue } from 'react-native';
import Animated, {
  LayoutAnimationConfig,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  NestedReorderableList,
  reorderItems,
  ScrollViewContainer,
  type ReorderableListCellAnimations,
  type ReorderableListReorderEvent,
} from 'react-native-reorderable-list';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EDITOR_ACTIONS_TOP, EDITOR_LIST_TOP, EditorActionRow } from '@/components/editor-chrome';
import { PlanDetailDayRow } from '@/components/plan-detail-day-row';
import { Button } from '@/components/button';
import { iconSize, space } from '@/constants/theme';
import { useTheme } from '@/theme/theme-context';
import { clonePrescription, emptyDay } from '@/domain/helpers';
import { newId, type WorkoutDay } from '@/domain/types';
import { DURATION, EASE_OUT, listReflow, rowIn } from '@/motion';
import { largeTitleOptions } from '@/navigation/large-title';
import { confirmPlanCreated } from '@/navigation/plan-created';
import { requirePro } from '@/purchases/pro-gate';
import { useUndoableDeletes } from '@/store/undoable-deletes';
import { useWorkoutStore } from '@/store/workout-store';

export function PlanEditorScreen() {
  const { colors, type } = useTheme();
  const params = useLocalSearchParams<{ id: string; new?: string }>();
  const id = params.id;
  // PE-2: opened to create a plan (Plans +, Home's Create plan, onboarding's Build my own),
  // so it gets a visible way out once it has work in it, and leaving confirms the plan.
  const isNew = params.new === '1';
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const lift = useDragLift();
  const { plans, activePlanId, updatePlan, activatePlan, deletePlan, isPro } =
    useWorkoutStore();
  const { removePlan, removeDay: removeDayWithUndo } = useUndoableDeletes();
  const plan = plans.find((item) => item.id === id);
  const planRef = useRef(plan);
  const deletedRef = useRef(false);
  const [openedUnnamed] = useState(() => plan != null && !plan.name.trim());

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

  // The name is the native large title, so it's edited in the system text prompt.
  const renamePlan = () => {
    const current = planRef.current;
    if (!current) {
      return;
    }
    Alert.prompt(
      current.name.trim() ? 'Rename plan' : 'Name this plan',
      undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          isPreferred: true,
          onPress: (value?: string) => {
            const latest = planRef.current;
            if (latest) {
              updatePlan({ ...latest, name: (value ?? '').trim() });
            }
          },
        },
      ],
      'plain-text',
      current.name,
    );
  };

  // A new plan asks for its name once it has slid in, where the old editor focused the name.
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

  // PE-1: an empty day goes straight to the picker; the picker then lands on Prescribe.
  const dayHref = (day: WorkoutDay) =>
    day.exercises.length === 0
      ? (`/exercises?planId=${plan.id}&dayId=${day.id}&dayTitle=${encodeURIComponent(day.title)}` as const)
      : (`/prescribe?planId=${plan.id}&dayId=${day.id}` as const);

  const renameDay = (dayId: string) => {
    router.push(`/prescribe?planId=${plan.id}&dayId=${dayId}&focus=title`);
  };

  const duplicateDay = (dayId: string) => {
    const index = plan.days.findIndex((item) => item.id === dayId);
    const source = plan.days[index];
    if (!source) {
      return;
    }
    const copy: WorkoutDay = {
      id: newId(),
      title: `${source.title.trim() || 'Day'} copy`,
      exercises: source.exercises.map(clonePrescription),
    };
    const days = [...plan.days.slice(0, index + 1), copy, ...plan.days.slice(index + 1)];
    updatePlan({ ...plan, days, daysPerWeek: days.length });
  };

  const moveDay = (dayId: string, delta: -1 | 1) => {
    const index = plan.days.findIndex((item) => item.id === dayId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= plan.days.length) {
      return;
    }
    const days = [...plan.days];
    [days[index], days[target]] = [days[target], days[index]];
    updatePlan({ ...plan, days });
  };

  const addDay = () => {
    const day = emptyDay(`Day ${plan.days.length + 1}`);
    updatePlan({
      ...plan,
      days: [...plan.days, day],
      daysPerWeek: plan.days.length + 1,
    });
  };

  const reorderDays = ({ from, to }: ReorderableListReorderEvent) => {
    if (from !== to) {
      updatePlan({ ...plan, days: reorderItems(plan.days, from, to) });
    }
  };

  const removeDay = (dayId: string) => {
    if (plan.days.length <= 1) {
      Alert.alert('Keep one day', 'A plan needs at least one training day.');
      return;
    }
    removeDayWithUndo(plan, dayId);
  };

  const named = plan.name.trim().length > 0;

  const hasExercises = plan.days.some((day) => day.exercises.length > 0);
  const showDone = isNew && hasExercises;

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
  const isActive = plan.id === activePlanId;
  const dayCount = plan.days.length;
  const dayMeta = dayCount === 1 ? '1 day' : `${dayCount} days`;

  return (
    <>
      <View style={{ flex: 1, backgroundColor: colors.systemBackground }}>
        <ScrollViewContainer
          style={{ flex: 1 }}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{
            paddingHorizontal: space.gutter,
            paddingBottom: showDone ? space.gutter : insets.bottom + space.gutter,
          }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: space.inline,
            }}>
            <Text style={[type.kicker, { color: colors.tertiaryLabel, flexShrink: 1 }]}>{dayMeta}</Text>
            {isActive ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.tight, flexShrink: 0 }}>
                <SymbolView name="checkmark" tintColor={colors.systemGreen} size={iconSize.caption} weight="medium" />
                <Text style={[type.kickerMedium, { color: colors.systemGreen }]}>Active</Text>
              </View>
            ) : null}
          </View>
          {/* Remove, Undo, Duplicate, Add and drag reflow the days in place (trim-ui §8, List
              reflows); nothing animates when the editor first appears. Rows pad themselves, so
              the list starts one row padding short of the 32. */}
          <View style={{ paddingTop: EDITOR_LIST_TOP - space.inset }}>
            <LayoutAnimationConfig skipEntering skipExiting>
              <NestedReorderableList
                // Full width: rows pad their own gutter, so the lifted surface reaches the edges.
                style={{ marginHorizontal: -space.gutter }}
                data={plan.days}
                keyExtractor={(day) => day.id}
                onReorder={reorderDays}
                onDragStart={lift.onDragStart}
                onDragEnd={lift.onDragEnd}
                onIndexChange={lift.onIndexChange}
                shouldUpdateActiveItem
                cellAnimations={lift.cellAnimations}
                animationDuration={DURATION.enter}
                itemLayoutAnimation={listReflow(reduceMotion)}
                renderItem={({ item: day, index }) => (
                  <Animated.View entering={rowIn(reduceMotion)}>
                    <PlanDetailDayRow
                      day={day}
                      index={index}
                      href={dayHref(day)}
                      reorderable={plan.days.length > 1}
                      actions={{
                        onRename: () => renameDay(day.id),
                        onDuplicate: () => duplicateDay(day.id),
                        onMoveUp: index > 0 ? () => moveDay(day.id, -1) : undefined,
                        onMoveDown: index < plan.days.length - 1 ? () => moveDay(day.id, 1) : undefined,
                        onRemove: plan.days.length > 1 ? () => removeDay(day.id) : undefined,
                      }}
                    />
                  </Animated.View>
                )}
              />
              <Animated.View layout={listReflow(reduceMotion)}>
                <EditorActionRow title="Add day" symbol="plus" tone="quiet" onPress={addDay} testID="plan-add-day" />
              </Animated.View>
            </LayoutAnimationConfig>
          </View>
          <Animated.View layout={listReflow(reduceMotion)} style={{ paddingTop: EDITOR_ACTIONS_TOP }}>
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
        </ScrollViewContainer>
        {showDone ? (
          <View
            style={{
              paddingHorizontal: space.gutter,
              paddingTop: space.related,
              paddingBottom: Math.max(insets.bottom, space.inset),
            }}>
            <Button title="Done" variant="black" testID="plan-done" onPress={finish} />
          </View>
        ) : null}
      </View>
      <Stack.Screen
        options={{
          ...largeTitleOptions(colors, named ? plan.name.trim() : 'New plan'),
          headerBackTitle: 'Plans',
        }}
      />
    </>
  );
}

const selectionTick = () => {
  void Haptics.selectionAsync();
};

/**
 * A dragged day lifts: scale 1.02 (`press`, ease-out) while the row wears the secondary
 * surface (`PlanDetailDayRow`), no shadow and no dimming, and settles back on release. Each slot it crosses ticks a selection haptic,
 * like a picker detent (trim-ui §8, Reorder). Reduced motion: the surface only.
 */
function useDragLift() {
  const reduceMotion = useReducedMotion();
  // Typed as the list's cell style expects (a shared value is invariant in its type).
  const scale = useSharedValue<AnimatableNumericValue>(1);
  const liftScale = reduceMotion ? 1 : 1.02;

  const cellAnimations: ReorderableListCellAnimations = {
    opacity: 1,
    transform: [{ scale }],
  };

  return {
    cellAnimations,
    onDragStart: () => {
      'worklet';
      const timing = { duration: DURATION.press, easing: EASE_OUT };
      scale.set(withTiming(liftScale, timing));
    },
    onDragEnd: () => {
      'worklet';
      const timing = { duration: DURATION.press, easing: EASE_OUT };
      scale.set(withTiming(1, timing));
    },
    onIndexChange: () => {
      'worklet';
      scheduleOnRN(selectionTick);
    },
  };
}
