import { useRouter } from 'expo-router';
import { useCallback, useRef } from 'react';

import { emptyPlanWithDays } from '@/catalog/templates';
import type { WorkoutPlan } from '@/domain/types';
import { openPaywall } from '@/purchases/pro-gate';
import { useWorkoutStore } from '@/store/workout-store';
import { track } from '@/analytics/analytics';

/**
 * The onboarding → app boundary is a one-way door. Each finish, in one tap:
 * 1. saves the plan and completes onboarding (one batched snapshot, so a kill never
 *    leaves a plan without completed onboarding, or the reverse);
 * 2. replaces the onboarding stack with Home, so Back can never re-enter it;
 * 3. opens what comes next above Home: the soft paywall, or the plan editor.
 *
 * The root layout's redirect effect does not act on a completion that happens during
 * this launch, so it never replaces the paywall or editor opened here.
 */
export function useFinishOnboarding() {
  const router = useRouter();
  const { savePlan, completeOnboarding, isPro } = useWorkoutStore();
  const finished = useRef(false);

  /** Template path: Home with Day 1 ready, then the soft `onboarding` paywall. */
  const finishWithPlan = useCallback(
    (plan: WorkoutPlan) => {
      if (finished.current) {
        return;
      }
      finished.current = true;
      savePlan(plan, { activate: true });
      completeOnboarding();
      track('onboarding_completed', { path: 'template', days_per_week: plan.days.length });
      router.replace('/');
      if (!isPro) {
        void openPaywall('onboarding');
      }
    },
    [completeOnboarding, isPro, router, savePlan],
  );

  /** Build my own: Home underneath, the plan editor on top. No onboarding paywall. */
  const finishBuildingOwn = useCallback(
    (daysPerWeek: number) => {
      if (finished.current) {
        return;
      }
      finished.current = true;
      const plan = emptyPlanWithDays(daysPerWeek);
      savePlan(plan, { activate: true });
      completeOnboarding();
      track('onboarding_completed', { path: 'own', days_per_week: daysPerWeek });
      router.replace('/');
      router.push(`/plan/${plan.id}`);
    },
    [completeOnboarding, router, savePlan],
  );

  return { finishWithPlan, finishBuildingOwn };
}
