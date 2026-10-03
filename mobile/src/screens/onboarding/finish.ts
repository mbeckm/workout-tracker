import { useRouter } from 'expo-router';
import { useCallback, useRef } from 'react';

import { emptyPlanWithDays } from '@/catalog/templates';
import type { WorkoutPlan } from '@/domain/types';
import { deviceHref } from '@/device/device-state';
import { openPaywall } from '@/purchases/pro-gate';
import { useWorkoutStore } from '@/store/workout-store';
import { track } from '@/analytics/analytics';

/**
 * The onboarding → app boundary is a one-way door. Each finish, in one tap:
 * 1. saves the plan and completes onboarding (one batched snapshot, so a kill never
 *    leaves a plan without completed onboarding, or the reverse);
 * 2. replaces the onboarding stack with the device, so Back can never re-enter it;
 * 3. opens what comes next: the soft paywall above the device, or the editor sheet on it.
 *
 * The root layout's redirect effect does not act on a completion that happens during
 * this launch, so it never replaces the paywall or editor opened here.
 */
export function useFinishOnboarding() {
  const router = useRouter();
  const { savePlan, completeOnboarding, isPro, userName } = useWorkoutStore();
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
      track('onboarding_completed', {
        path: 'template',
        days_per_week: plan.days.length,
        has_name: userName !== '',
      });
      router.replace('/');
      if (!isPro) {
        void openPaywall('onboarding');
      }
    },
    [completeOnboarding, isPro, router, savePlan, userName],
  );

  /**
   * Build my own: the device with the editor sheet up, opened as a new plan so it gets
   * Done and the "Plan created" confirmation like every other new plan. No onboarding paywall.
   */
  const finishBuildingOwn = useCallback(
    (daysPerWeek: number) => {
      if (finished.current) {
        return;
      }
      finished.current = true;
      const plan = emptyPlanWithDays(daysPerWeek);
      savePlan(plan, { activate: true });
      completeOnboarding();
      track('onboarding_completed', { path: 'own', days_per_week: daysPerWeek, has_name: userName !== '' });
      // The device with the editor sheet up, as a new plan (`?sheet=editor&planId&new=1`).
      router.replace(deviceHref({ sheet: 'editor', params: { planId: plan.id, new: '1' } }));
    },
    [completeOnboarding, router, savePlan, userName],
  );

  return { finishWithPlan, finishBuildingOwn };
}
