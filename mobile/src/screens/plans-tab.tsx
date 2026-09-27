import { Link, Stack, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useRef } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { PaperEmpty, PaperScreen } from '@/components/paper';
import { radius } from '@/constants/theme';
import { useTheme } from '@/theme/theme-context';
import { emptyPlan } from '@/domain/helpers';
import type { WorkoutPlan } from '@/domain/types';
import { requirePro } from '@/purchases/pro-gate';
import { useWorkoutStore } from '@/store/workout-store';

function formatDaysCount(count: number): string {
  return count === 1 ? '1 day' : `${count} days`;
}

export function PlansTab() {
  const { colors, type } = useTheme();
  const router = useRouter();
  const { plans, activePlanId, savePlan, activatePlan, deletePlan, isPro } = useWorkoutStore();
  const gating = useRef(false);
  const activePlan = plans.find((plan) => plan.id === activePlanId) ?? null;
  const otherPlans = plans.filter((plan) => plan.id !== activePlan?.id);

  const createPlan = async () => {
    if (gating.current) {
      return;
    }
    if (plans.length > 0) {
      gating.current = true;
      const allowed = await requirePro('second_plan').finally(() => {
        gating.current = false;
      });
      if (!allowed) {
        return;
      }
    }
    const plan = emptyPlan();
    savePlan(plan, { activate: plans.length === 0 });
    router.push(`/plan/${plan.id}?new=1`);
  };

  const confirmDelete = (plan: WorkoutPlan) => {
    Alert.alert('Delete plan?', plan.name.trim() || 'Untitled plan', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deletePlan(plan) },
    ]);
  };

  return (
    <>
      <PaperScreen>
        {plans.length === 0 ? (
          <PaperEmpty
            testID="plans-empty"
            title="Plans"
            subject="No plans yet"
            caption="Days, exercises, sets and reps."
            action={{ title: 'Create plan', onPress: createPlan, testID: 'plans-create' }}
          />
        ) : (
          <>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                minHeight: 34,
              }}>
              <Text style={type.planTitle} maxFontSizeMultiplier={1.2} accessibilityRole="header">
                Plans
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Create plan"
                hitSlop={12}
                onPress={createPlan}
                testID="plans-create"
                style={({ pressed }) => ({
                  height: 34,
                  width: 34,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  opacity: pressed ? 0.55 : 1,
                })}>
                <SymbolView name="plus" tintColor={colors.label} size={22} weight="medium" />
              </Pressable>
            </View>
            {activePlan ? (
              <PlanMenuRow
                plan={activePlan}
                variant="active"
                onActivate={() => activatePlan(activePlan)}
                onDelete={() => confirmDelete(activePlan)}
              />
            ) : null}
            {otherPlans.length > 0 ? (
              <View style={{ paddingTop: activePlan ? 32 : 28 }}>
                {otherPlans.map((plan, index) => (
                  <PlanMenuRow
                    key={plan.id}
                    plan={plan}
                    variant="row"
                    proLabel={!isPro}
                    showSeparator={index < otherPlans.length - 1}
                    onActivate={async () => {
                      if (await requirePro('switch_plan')) {
                        activatePlan(plan);
                      }
                    }}
                    onDelete={() => confirmDelete(plan)}
                  />
                ))}
              </View>
            ) : null}
          </>
        )}
      </PaperScreen>
      <Stack.Screen options={{ headerShown: false, title: 'Plans' }} />
    </>
  );
}

function PlanMenuRow({
  plan,
  variant,
  showSeparator = false,
  proLabel = false,
  onActivate,
  onDelete,
}: {
  plan: WorkoutPlan;
  variant: 'active' | 'row';
  showSeparator?: boolean;
  /** Free users: say the switch is Pro so the paywall isn't a surprise (PL-2). */
  proLabel?: boolean;
  onActivate: () => void;
  onDelete: () => void;
}) {
  const { colors, type } = useTheme();
  const name = plan.name.trim() || 'Untitled plan';
  const days = formatDaysCount(plan.days.length);
  const isActive = variant === 'active';

  return (
    <Link href={`/plan/${plan.id}`} asChild>
      <Link.Trigger>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isActive ? `${name}, ${days}, Active` : `${name}, ${days}`}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          {isActive ? (
            <View
              style={{
                marginTop: 28,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 16,
                borderRadius: radius.md,
                borderCurve: 'continuous',
                backgroundColor: colors.secondarySystemBackground,
              }}>
              <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
                <Text style={type.title} numberOfLines={1}>
                  {name}
                </Text>
                <Text style={[type.kicker, { color: colors.tertiaryLabel }]}>{days}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <SymbolView name="checkmark" tintColor={colors.systemGreen} size={18} weight="medium" />
                <Text style={[type.kickerMedium, { color: colors.systemGreen }]}>Active</Text>
              </View>
            </View>
          ) : (
            <View
              style={{
                paddingVertical: 14,
                gap: 2,
                borderBottomWidth: showSeparator ? 0.5 : 0,
                borderBottomColor: colors.separator,
              }}>
              <Text style={type.row} numberOfLines={1}>
                {name}
              </Text>
              <Text style={[type.kicker, { color: colors.tertiaryLabel }]}>{days}</Text>
            </View>
          )}
        </Pressable>
      </Link.Trigger>
      <Link.Menu>
        {isActive ? null : (
          <Link.MenuAction
            title={proLabel ? 'Use this plan (Pro)' : 'Use this plan'}
            icon="checkmark.circle"
            onPress={onActivate}
          />
        )}
        <Link.MenuAction title="Delete" icon="trash" destructive onPress={onDelete} />
      </Link.Menu>
    </Link>
  );
}
