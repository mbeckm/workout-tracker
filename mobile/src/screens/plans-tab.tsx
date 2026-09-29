import { Link, useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, {
  LayoutAnimationConfig,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { HeaderActions } from '@/components/button';
import { PaperEmpty } from '@/components/paper';
import { iconSize, PRESSED_OPACITY, radius, space } from '@/constants/theme';
import { EASE_IN_OUT, EASE_OUT, exitFade, listReflow, rowIn } from '@/motion';
import { takeRevealedPlan } from '@/navigation/plan-created';
import { useTheme } from '@/theme/theme-context';
import { emptyPlan } from '@/domain/helpers';
import type { WorkoutPlan } from '@/domain/types';
import { requirePro } from '@/purchases/pro-gate';
import { useUndoableDeletes } from '@/store/undoable-deletes';
import { useWorkoutStore } from '@/store/workout-store';

function formatDaysCount(count: number): string {
  return count === 1 ? '1 day' : `${count} days`;
}

/**
 * A plan just created (and not active) lights its row once when Plans comes back: the
 * surface fades in as the editor finishes leaving, holds while the toast rises, then
 * dissolves. Opacity only, so Reduce Motion keeps it (it explains where the plan went).
 */
const REVEAL_DELAY_MS = 240;
const REVEAL_IN_MS = 180;
const REVEAL_HOLD_MS = 700;
const REVEAL_OUT_MS = 520;
const REVEAL_TOTAL_MS = REVEAL_DELAY_MS + REVEAL_IN_MS + REVEAL_HOLD_MS + REVEAL_OUT_MS;

export function PlansTab() {
  const { colors } = useTheme();
  const router = useRouter();
  const { plans, activePlanId, savePlan, activatePlan, isPro } = useWorkoutStore();
  const { removePlan } = useUndoableDeletes();
  const reduceMotion = useReducedMotion();
  const gating = useRef(false);
  const activePlan = plans.find((plan) => plan.id === activePlanId) ?? null;
  const otherPlans = plans.filter((plan) => plan.id !== activePlan?.id);
  const [revealedPlanId, setRevealedPlanId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      const planId = takeRevealedPlan();
      if (!planId) {
        return;
      }
      setRevealedPlanId(planId);
      const timer = setTimeout(() => setRevealedPlanId(null), REVEAL_TOTAL_MS);
      return () => {
        clearTimeout(timer);
        setRevealedPlanId(null);
      };
    }, []),
  );

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

  const confirmDelete = (plan: WorkoutPlan) => removePlan(plan);

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.systemBackground }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: space.gutter,
          paddingTop: space.related,
          paddingBottom: space.section,
        }}>
        {plans.length === 0 ? (
          <PaperEmpty
            testID="plans-empty"
            subject="No plans yet"
            action={{ title: 'Create plan', onPress: createPlan, testID: 'plans-create' }}
          />
        ) : (
          // Delete, Undo and Use this plan move rows in place (trim-ui §8, List reflows);
          // nothing animates when Plans first appears.
          <LayoutAnimationConfig skipEntering skipExiting>
            {activePlan ? (
              <Animated.View
                key={activePlan.id}
                entering={rowIn(reduceMotion)}
                exiting={exitFade(reduceMotion)}
                layout={listReflow(reduceMotion)}>
                <PlanMenuRow
                  plan={activePlan}
                  variant="active"
                  onActivate={() => activatePlan(activePlan)}
                  onDelete={() => confirmDelete(activePlan)}
                />
              </Animated.View>
            ) : null}
            {otherPlans.length > 0 ? (
              <Animated.View
                layout={listReflow(reduceMotion)}
                style={{ paddingTop: activePlan ? space.section : 0 }}>
                {otherPlans.map((plan, index) => (
                  <Animated.View
                    key={plan.id}
                    entering={rowIn(reduceMotion)}
                    exiting={exitFade(reduceMotion)}
                    layout={listReflow(reduceMotion)}>
                    <PlanMenuRow
                      plan={plan}
                      variant="row"
                      proLabel={!isPro}
                      revealed={plan.id === revealedPlanId}
                      showSeparator={index < otherPlans.length - 1}
                      onActivate={async () => {
                        if (await requirePro('switch_plan')) {
                          activatePlan(plan);
                        }
                      }}
                      onDelete={() => confirmDelete(plan)}
                    />
                  </Animated.View>
                ))}
              </Animated.View>
            ) : null}
          </LayoutAnimationConfig>
        )}
      </ScrollView>
      {plans.length > 0 ? (
        <HeaderActions right={{ title: 'Create plan', icon: 'plus', variant: 'plain', onPress: createPlan }} />
      ) : null}
    </>
  );
}

function PlanMenuRow({
  plan,
  variant,
  showSeparator = false,
  proLabel = false,
  revealed = false,
  onActivate,
  onDelete,
}: {
  plan: WorkoutPlan;
  variant: 'active' | 'row';
  showSeparator?: boolean;
  /** Free users: say the switch is Pro so the paywall isn't a surprise (PL-2). */
  proLabel?: boolean;
  /** Just created: light the row once so the eye finds where the plan went. */
  revealed?: boolean;
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
          style={({ pressed }) => ({ opacity: pressed ? PRESSED_OPACITY : 1 })}>
          {isActive ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.inline,
                padding: space.inset,
                borderRadius: radius.md,
                borderCurve: 'continuous',
                backgroundColor: colors.secondarySystemBackground,
              }}>
              <View style={{ flex: 1, gap: space.tight, minWidth: 0 }}>
                <Text style={type.title} numberOfLines={1}>
                  {name}
                </Text>
                <Text style={[type.kicker, { color: colors.tertiaryLabel }]}>{days}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.tight, flexShrink: 0 }}>
                <SymbolView name="checkmark" tintColor={colors.systemGreen} size={iconSize.caption} weight="medium" />
                <Text style={[type.kickerMedium, { color: colors.systemGreen }]}>Active</Text>
              </View>
            </View>
          ) : (
            <View
              style={{
                paddingVertical: space.inset,
                gap: space.pair,
                borderBottomWidth: showSeparator ? 0.5 : 0,
                borderBottomColor: colors.separator,
              }}>
              <RevealSurface revealed={revealed} />
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

/**
 * The row briefly wears the same 16-inset surface as the active plan card, then lets it go.
 * Inset 2pt top and bottom so it never touches a hairline separator. Decorative: VoiceOver
 * hears the toast instead.
 */
function RevealSurface({ revealed }: { revealed: boolean }) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!revealed) {
      return;
    }
    // Never: a fade explains where the plan went, so it plays under Reduce Motion too
    // (the System default would jump straight to the end and show nothing).
    const never = ReduceMotion.Never;
    opacity.set(
      withDelay(
        REVEAL_DELAY_MS,
        withSequence(
          never,
          withTiming(1, { duration: REVEAL_IN_MS, easing: EASE_OUT, reduceMotion: never }),
          withDelay(
            REVEAL_HOLD_MS,
            withTiming(0, { duration: REVEAL_OUT_MS, easing: EASE_IN_OUT, reduceMotion: never }),
            never,
          ),
        ),
        never,
      ),
    );
  }, [opacity, revealed]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      style={[
        {
          position: 'absolute',
          top: 2,
          bottom: 2,
          left: -16,
          right: -16,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          backgroundColor: colors.systemGray5,
        },
        style,
      ]}
    />
  );
}
