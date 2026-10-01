import { Link, useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { HeaderActions } from '@/components/button';
import { PaperEmpty } from '@/components/paper';
import { iconSize, PRESSED_OPACITY, radius, space } from '@/constants/theme';
import { EASE_IN_OUT, EASE_OUT } from '@/motion';
import { takeRevealedPlan } from '@/navigation/plan-created';
import { useTheme } from '@/theme/theme-context';
import { STARTER_TEMPLATES, planFromStarterTemplate, type StarterTemplate } from '@/catalog/templates';
import { formatDoneWhen, formatExerciseNames } from '@/domain/day-facts';
import { emptyPlan } from '@/domain/helpers';
import { completedPlanDayIdsSince, startOfLocalWeek } from '@/domain/plan-loop';
import type { WorkoutPlan } from '@/domain/types';
import { requirePro } from '@/purchases/pro-gate';
import { useUndoableDeletes } from '@/store/undoable-deletes';
import { useWorkoutStore } from '@/store/workout-store';

function formatDaysCount(count: number): string {
  return count === 1 ? '1 day' : `${count} days`;
}

/** `Push, Pull and Legs`: what a plan holds, in its days' own words. */
function dayNames(plan: WorkoutPlan): string {
  return formatExerciseNames(
    plan.days.map((day) => day.title.trim() || 'Day'),
    3,
  );
}

/** `trained today`, `last Thu 17`: when a plan last saw a workout. */
function lastTrained(iso: string): string {
  const when = formatDoneWhen(iso);
  return when === 'Today' || when === 'Yesterday' ? `trained ${when.toLowerCase()}` : `last ${when}`;
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

/**
 * Plans v2 (trim-ui §13 Plans; PRODUCT-DECISIONS 72). Which plan you're on and what's in it,
 * the others you have, and where a new one can start. The active plan is the hero: its name, a
 * fact line from your own history (`4 days a week, 12 workouts`), and its days with what each
 * holds, a green ✓ on the ones done this week (Home's meaning). Other plans say what they are
 * in their days' names and when you last trained them. Templates close the page: the free
 * starter plans, one tap from a copy of your own.
 */
export function PlansTab() {
  const { colors, type } = useTheme();
  const router = useRouter();
  const { plans, activePlanId, savePlan, activatePlan, isPro, workoutHistory } = useWorkoutStore();
  const { removePlan } = useUndoableDeletes();
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

  const doneThisWeek = useMemo(
    () => new Set(completedPlanDayIdsSince(activePlan, workoutHistory, startOfLocalWeek())),
    [activePlan, workoutHistory],
  );

  const history = useMemo(() => {
    const byPlan = new Map<string, { count: number; last: string | null }>();
    for (const workout of workoutHistory) {
      if (!workout.planId || workout.setCount <= 0) {
        continue;
      }
      const entry = byPlan.get(workout.planId) ?? { count: 0, last: null };
      entry.count += 1;
      if (!entry.last || workout.completedAt > entry.last) {
        entry.last = workout.completedAt;
      }
      byPlan.set(workout.planId, entry);
    }
    return byPlan;
  }, [workoutHistory]);

  // A second plan is Pro, whether it's built from scratch or from a template.
  const mayAddPlan = async () => {
    if (gating.current) {
      return false;
    }
    if (plans.length === 0) {
      return true;
    }
    gating.current = true;
    return requirePro('second_plan').finally(() => {
      gating.current = false;
    });
  };

  const createPlan = async () => {
    if (!(await mayAddPlan())) {
      return;
    }
    const plan = emptyPlan();
    savePlan(plan, { activate: plans.length === 0 });
    router.push(`/plan/${plan.id}?new=1`);
  };

  const startFromTemplate = async (template: StarterTemplate) => {
    if (!(await mayAddPlan())) {
      return;
    }
    const plan = planFromStarterTemplate(template);
    savePlan(plan, { activate: plans.length === 0 });
    router.push(`/plan/${plan.id}?new=1`);
  };

  const confirmDelete = (plan: WorkoutPlan) => removePlan(plan);

  // A template you already have as a plan (same name, same days) isn't offered again.
  const templates = STARTER_TEMPLATES.filter(
    (template) =>
      !plans.some((plan) => plan.name.trim() === template.name && plan.days.length === template.daysPerWeek),
  );

  // The same name sheet as the plan editor's Rename plan (trim-ui §10 Rename).
  const renamePlan = (plan: WorkoutPlan) => router.push(`/edit?planId=${plan.id}&focus=1`);

  const activeFacts = activePlan
    ? [
        `${activePlan.days.length} ${activePlan.days.length === 1 ? 'day' : 'days'} a week`,
        (() => {
          const count = history.get(activePlan.id)?.count ?? 0;
          return count === 0 ? null : count === 1 ? '1 workout' : `${count} workouts`;
        })(),
      ]
        .filter(Boolean)
        .join(', ')
    : '';

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.systemBackground }}
        contentInsetAdjustmentBehavior="automatic"
        // Everything shares the title's leading edge; each section starts `section` below the
        // last, measured to what you see (trim-ui → Layout → Under a large title).
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: space.margin,
          paddingTop: space.section,
          paddingBottom: space.section,
        }}>
        {plans.length === 0 ? (
          <PaperEmpty
            testID="plans-empty"
            subject="No plans yet"
            action={{
              title: 'Create plan',
              onPress: createPlan,
              testID: 'plans-create',
            }}
          />
        ) : null}

        {activePlan ? (
          <PlanLink
            plan={activePlan}
            proLabel={false}
            isActive
            onActivate={() => activatePlan(activePlan)}
            onRename={() => renamePlan(activePlan)}
            onDelete={() => confirmDelete(activePlan)}>
            <View
              testID="plans-active"
              style={{
                padding: space.inset,
                gap: space.inline,
                borderRadius: radius.lg,
                borderCurve: 'continuous',
                backgroundColor: colors.secondarySystemBackground,
              }}>
              <View style={{ gap: space.tight }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.tight,
                  }}>
                  <SymbolView
                    name="checkmark"
                    tintColor={colors.systemGreen}
                    size={iconSize.caption}
                    weight="semibold"
                  />
                  <Text style={[type.caption, { color: colors.systemGreen }]}>Active</Text>
                </View>
                <Text style={type.title} numberOfLines={2}>
                  {activePlan.name.trim() || 'Untitled plan'}
                </Text>
                <Text style={type.caption}>{activeFacts}</Text>
              </View>
              <View>
                {activePlan.days.map((day, index) => {
                  const names = formatExerciseNames(
                    day.exercises.map((exercise) => exercise.name),
                    1,
                  );
                  const done = doneThisWeek.has(day.id);
                  return (
                    <View
                      key={day.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: space.inline,
                        paddingVertical: space.related + space.tight,
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: colors.separator,
                      }}>
                      <View style={{ flex: 1, minWidth: 0, gap: space.pair }}>
                        <Text style={type.row} numberOfLines={1}>
                          {day.title.trim() || `Day ${index + 1}`}
                        </Text>
                        <Text style={type.caption} numberOfLines={1}>
                          {names || 'No exercises yet'}
                        </Text>
                      </View>
                      {done ? (
                        <SymbolView
                          name="checkmark"
                          tintColor={colors.systemGreen}
                          size={iconSize.row}
                          weight="semibold"
                          accessibilityLabel="Done this week"
                        />
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          </PlanLink>
        ) : null}

        {otherPlans.length > 0 ? (
          <View style={{ paddingTop: activePlan ? space.section : 0 }}>
            {otherPlans.map((plan, index) => {
              const last = history.get(plan.id)?.last;
              const meta = [
                dayNames(plan) || formatDaysCount(plan.days.length),
                last ? lastTrained(last) : null,
              ]
                .filter(Boolean)
                .join(', ');
              return (
                <PlanLink
                  key={plan.id}
                  plan={plan}
                  proLabel={!isPro}
                  isActive={false}
                  onActivate={async () => {
                    if (await requirePro('switch_plan')) {
                      activatePlan(plan);
                    }
                  }}
                  onRename={() => renamePlan(plan)}
                  onDelete={() => confirmDelete(plan)}>
                  <View
                    style={{
                      paddingVertical: space.inset,
                      gap: space.pair,
                      borderBottomWidth: index < otherPlans.length - 1 ? StyleSheet.hairlineWidth : 0,
                      borderBottomColor: colors.separator,
                    }}>
                    <RevealSurface revealed={plan.id === revealedPlanId} />
                    <Text style={type.row} numberOfLines={1}>
                      {plan.name.trim() || 'Untitled plan'}
                    </Text>
                    <Text style={type.caption} numberOfLines={1}>
                      {meta}
                    </Text>
                  </View>
                </PlanLink>
              );
            })}
          </View>
        ) : null}

        {/* Templates close the page, and fill an empty one: a plan is one tap away. */}
        <View style={{ paddingTop: space.section }} testID="plans-templates">
          <Text style={[type.caption, { paddingBottom: space.tight }]} accessibilityRole="header">
            Templates
          </Text>
          {templates.map((template, index) => (
            <Pressable
              key={template.id}
              accessibilityRole="button"
              accessibilityLabel={`${template.name}, ${template.daysPerWeek} days a week`}
              accessibilityHint="Starts a new plan from this template"
              onPress={() => startFromTemplate(template)}
              testID={`plans-template-${template.id}`}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.inline,
                paddingVertical: space.inset,
                borderBottomWidth: index < templates.length - 1 ? StyleSheet.hairlineWidth : 0,
                borderBottomColor: colors.separator,
                opacity: pressed ? PRESSED_OPACITY : 1,
              })}>
              <View style={{ flex: 1, minWidth: 0, gap: space.pair }}>
                <Text style={type.row} numberOfLines={1}>
                  {template.name}
                </Text>
                <Text style={type.caption} numberOfLines={1}>
                  {`${template.daysPerWeek} days a week`}
                </Text>
              </View>
              <SymbolView name="plus" tintColor={colors.brand} size={iconSize.row} weight="semibold" />
            </Pressable>
          ))}
        </View>
      </ScrollView>
      {plans.length > 0 ? (
        <HeaderActions
          right={{
            title: 'Create plan',
            icon: 'plus',
            variant: 'plain',
            onPress: createPlan,
          }}
        />
      ) : null}
    </>
  );
}

/** A plan you can open (tap), with Use / Rename / Delete on a long press. */
function PlanLink({
  plan,
  isActive,
  proLabel,
  onActivate,
  onRename,
  onDelete,
  children,
}: {
  plan: WorkoutPlan;
  isActive: boolean;
  /** Free users: say the switch is Pro so the paywall isn't a surprise (PL-2). */
  proLabel: boolean;
  onActivate: () => void;
  onRename: () => void;
  onDelete: () => void;
  children: ReactNode;
}) {
  const name = plan.name.trim() || 'Untitled plan';
  return (
    <Link href={`/plan/${plan.id}`} asChild>
      <Link.Trigger>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isActive ? `${name}, active, ${dayNames(plan)}` : `${name}, ${dayNames(plan)}`}
          style={({ pressed }) => ({ opacity: pressed ? PRESSED_OPACITY : 1 })}>
          {children}
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
        <Link.MenuAction title="Rename" icon="pencil" onPress={onRename} />
        <Link.MenuAction title="Delete" icon="trash" destructive onPress={onDelete} />
      </Link.Menu>
    </Link>
  );
}

/**
 * The row briefly lights up edge to edge, like a system list row's highlight, then lets it go.
 * The row's text sits on the title's edge, so a rounded card around it would touch the screen
 * edge. It stops above the row's hairline. Decorative: VoiceOver hears the toast instead.
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
          top: 0,
          bottom: 0,
          left: -space.margin,
          right: -space.margin,
          backgroundColor: colors.systemGray5,
        },
        style,
      ]}
    />
  );
}
