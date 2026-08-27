import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef } from 'react';
import { ScrollView, Alert, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EDITOR_ACTIONS_TOP, EDITOR_LIST_TOP, EditorActionRow } from '@/components/editor-chrome';
import { PlanDetailDayRow } from '@/components/plan-detail-day-row';
import { PaperBack } from '@/components/paper';
import { useTheme } from '@/theme/theme-context';
import { emptyDay } from '@/domain/helpers';
import { useWorkoutStore } from '@/store/workout-store';

export function PlanEditorScreen() {
  const { colors, type } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { plans, activePlanId, updatePlan, activatePlan, deletePlan } = useWorkoutStore();
  const plan = plans.find((item) => item.id === id);
  const planRef = useRef(plan);
  const openedUnnamed = useRef(false);
  const capturedOpen = useRef(false);
  planRef.current = plan;
  if (plan && !capturedOpen.current) {
    capturedOpen.current = true;
    openedUnnamed.current = !plan.name.trim();
  }

  useEffect(() => {
    return navigation.addListener('beforeRemove', () => {
      const current = planRef.current;
      const unusedDraft =
        openedUnnamed.current &&
        current != null &&
        !current.name.trim() &&
        current.days.every((day) => day.exercises.length === 0);
      if (unusedDraft) {
        deletePlan(current, { archive: false });
      }
    });
  }, [deletePlan, navigation]);

  if (!plan) {
    return <View style={{ flex: 1, backgroundColor: colors.systemBackground }} />;
  }

  const openDay = (dayId: string) => {
    const day = plan.days.find((item) => item.id === dayId);
    if (!day) {
      return;
    }
    router.push(`/prescribe?planId=${plan.id}&dayId=${day.id}`);
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
          scrollEnabled={false}
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
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          <View style={{ paddingTop: EDITOR_LIST_TOP }}>
            {plan.days.map((day, index) => (
              <PlanDetailDayRow
                key={day.id}
                day={day}
                index={index}
                isFirst={index === 0}
                onPress={() => openDay(day.id)}
                onLongPress={plan.days.length > 1 ? () => removeDay(day.id) : undefined}
              />
            ))}
            <EditorActionRow title="Add day" symbol="plus" tone="quiet" onPress={addDay} testID="plan-add-day" />
          </View>
          <View style={{ paddingTop: EDITOR_ACTIONS_TOP }}>
            {isActive ? null : (
              <EditorActionRow
                title="Use this plan"
                symbol="checkmark"
                onPress={() => activatePlan(plan)}
              />
            )}
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
          </View>
        </ScrollView>
      </View>
      <Stack.Screen options={{ headerShown: false, title: named ? 'Plan' : 'New plan', keyboardHandlingEnabled: false }} />
    </>
  );
}
