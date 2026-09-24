import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Alert, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EDITOR_ACTIONS_TOP, EDITOR_LIST_TOP, EditorActionRow } from '@/components/editor-chrome';
import { PlanDetailDayRow } from '@/components/plan-detail-day-row';
import { Button } from '@/components/button';
import { PaperBack } from '@/components/paper';
import { useTheme } from '@/theme/theme-context';
import { clonePrescription, emptyDay } from '@/domain/helpers';
import { newId, type WorkoutDay } from '@/domain/types';
import { requirePro } from '@/purchases/pro-gate';
import { useWorkoutStore } from '@/store/workout-store';

export function PlanEditorScreen() {
  const { colors, type } = useTheme();
  const params = useLocalSearchParams<{ id: string; new?: string }>();
  const id = params.id;
  // PE-2: opened from Create plan, so it gets a visible way out once it has work in it.
  const isNew = params.new === '1';
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { plans, activePlanId, updatePlan, activatePlan, deletePlan, isPro } =
    useWorkoutStore();
  const plan = plans.find((item) => item.id === id);
  const planRef = useRef(plan);
  const [openedUnnamed] = useState(() => plan != null && !plan.name.trim());

  useEffect(() => {
    planRef.current = plan;
  }, [plan]);

  useEffect(() => {
    return navigation.addListener('beforeRemove', () => {
      const current = planRef.current;
      const unusedDraft =
        openedUnnamed &&
        current != null &&
        !current.name.trim() &&
        current.days.every((day) => day.exercises.length === 0);
      if (unusedDraft) {
        deletePlan(current, { archive: false });
      }
    });
  }, [deletePlan, navigation, openedUnnamed]);

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

  const removeDay = (dayId: string) => {
    if (plan.days.length <= 1) {
      Alert.alert('Keep one day', 'A plan needs at least one training day.');
      return;
    }
    const day = plan.days.find((item) => item.id === dayId);
    Alert.alert('Remove day?', day?.title ?? 'This day', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          updatePlan({
            ...plan,
            days: plan.days.filter((item) => item.id !== dayId),
            daysPerWeek: plan.days.length - 1,
          }),
      },
    ]);
  };

  const named = plan.name.trim().length > 0;
  const hasExercises = plan.days.some((day) => day.exercises.length > 0);
  const showDone = isNew && hasExercises;

  const finish = () => {
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
      <View
        style={{
          flex: 1,
          backgroundColor: colors.systemBackground,
          paddingTop: insets.top + 16,
          paddingHorizontal: 24,
        }}>
        <PaperBack onPress={() => router.back()} />
        <TextInput
          value={plan.name}
          onChangeText={(name) => updatePlan({ ...plan, name })}
          placeholder="Untitled"
          placeholderTextColor={colors.tertiaryLabel}
          accessibilityLabel="Plan name"
          autoFocus={!named}
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          scrollEnabled={false}
          maxFontSizeMultiplier={1.2}
          style={[type.displayDay, { padding: 0, margin: 0 }]}
        />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingTop: 4,
            flexWrap: 'wrap',
          }}>
          <Text style={[type.kicker, { color: colors.tertiaryLabel }]}>{dayMeta}</Text>
          {isActive ? (
            <>
              <Text style={[type.kicker, { color: colors.tertiaryLabel }]}>·</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <SymbolView name="checkmark" tintColor={colors.systemGreen} size={14} weight="medium" />
                <Text style={[type.kickerMedium, { color: colors.systemGreen }]}>Active</Text>
              </View>
            </>
          ) : null}
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets={false}
          contentContainerStyle={{ paddingBottom: showDone ? 24 : insets.bottom + 24 }}>
          <View style={{ paddingTop: EDITOR_LIST_TOP }}>
            {plan.days.map((day, index) => (
              <PlanDetailDayRow
                key={day.id}
                day={day}
                index={index}
                href={dayHref(day)}
                isFirst={index === 0}
                actions={{
                  onRename: () => renameDay(day.id),
                  onDuplicate: () => duplicateDay(day.id),
                  onMoveUp: index > 0 ? () => moveDay(day.id, -1) : undefined,
                  onMoveDown: index < plan.days.length - 1 ? () => moveDay(day.id, 1) : undefined,
                  onRemove: plan.days.length > 1 ? () => removeDay(day.id) : undefined,
                }}
              />
            ))}
            <EditorActionRow title="Add day" symbol="plus" tone="quiet" onPress={addDay} testID="plan-add-day" />
          </View>
          <View style={{ paddingTop: EDITOR_ACTIONS_TOP }}>
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
                onPress={() =>
                  Alert.alert('Delete plan?', plan.name.trim() || 'Untitled plan', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => {
                        deletePlan(plan);
                        router.back();
                      },
                    },
                  ])
                }
              />
            ) : null}
          </View>
        </ScrollView>
        {showDone ? (
          <View style={{ paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12) }}>
            <Button title="Done" variant="black" testID="plan-done" onPress={finish} />
          </View>
        ) : null}
      </View>
      <Stack.Screen options={{ headerShown: false, title: named ? 'Plan' : 'New plan', keyboardHandlingEnabled: false }} />
    </>
  );
}
