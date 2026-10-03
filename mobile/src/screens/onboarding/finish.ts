import { useRouter } from 'expo-router';
import { useCallback, useRef } from 'react';

import { emptyPlanWithDays } from '@/catalog/templates';
import type { Finish } from '@/domain/finish';
import type { WorkoutPlan } from '@/domain/types';
import { useInsertMoment } from '@/device/activation';
import { useDevice } from '@/device/device-context';
import { useFinish } from '@/device/finish';
import { openPaywall } from '@/purchases/pro-gate';
import { useWorkoutStore } from '@/store/workout-store';
import { track } from '@/analytics/analytics';

/**
 * The onboarding → app boundary is a one-way door. Each finish, in one tap:
 * 1. saves the plan and completes onboarding (one batched snapshot, so a kill never
 *    leaves a plan without completed onboarding, or the reverse);
 * 2. replaces the onboarding stack with the device, so Back can never re-enter it;
 * 3. plays "Plan ready" (the cartridge insert on the device, D12) and, once it has ended (played,
 *    skipped, Reduce Motion or backgrounded), opens what comes next: the soft paywall, or the
 *    editor sheet. Never two moments at once.
 *
 * The finish (D3): a free finish was saved when it was picked. A locked one is only previewed;
 * it stays if the paywall ends with Trim Pro, otherwise the device falls back to the free finish
 * saved last (212 unless they picked 101).
 *
 * The root layout's redirect effect does not act on a completion that happens during
 * this launch, so it never replaces the paywall or editor opened here.
 */
export function useFinishOnboarding() {
  const router = useRouter();
  const { savePlan, completeOnboarding, isPro, userName, setFinish, finish: savedFinish } = useWorkoutStore();
  const { setPreview } = useFinish();
  const { openSheet } = useDevice();
  // The plan is already active (saved with `activate`), so the moment plays without Use plan's gates.
  const playPlanReady = useInsertMoment();
  const finished = useRef(false);

  const keepFinish = useCallback(
    (finish: Finish) => {
      setFinish(finish);
      setPreview(null);
      track('finish_selected', { finish });
    },
    [setFinish, setPreview],
  );

  /** Template path: the plan loads into the device ("Plan ready"), then the `onboarding` paywall. */
  const finishWithPlan = useCallback(
    (plan: WorkoutPlan, lockedFinish: Finish | null) => {
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
      void (async () => {
        await playPlanReady(plan.id, 'onboarding');
        if (isPro) {
          keepFinish(lockedFinish ?? savedFinish);
          return;
        }
        const outcome = await openPaywall('onboarding');
        const bought = outcome === 'purchased' || outcome === 'restored';
        keepFinish(lockedFinish && bought ? lockedFinish : savedFinish);
      })();
    },
    [completeOnboarding, isPro, keepFinish, playPlanReady, router, savePlan, savedFinish, userName],
  );

  /**
   * Build my own (D12): its empty days go into the slot (the insert), then the editor sheet comes
   * up over the device, opened as a new plan so it gets Done and the "Plan created" confirmation
   * like every other new plan. No onboarding paywall, so a previewed Pro finish falls back.
   * `emptyPlanWithDays` is exempt from the a-lift-first rule.
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
      keepFinish(savedFinish);
      track('onboarding_completed', { path: 'own', days_per_week: daysPerWeek, has_name: userName !== '' });
      router.replace('/');
      void (async () => {
        await playPlanReady(plan.id, 'onboarding');
        openSheet('editor', { planId: plan.id, new: '1' });
      })();
    },
    [completeOnboarding, keepFinish, openSheet, playPlanReady, router, savePlan, savedFinish, userName],
  );

  return { finishWithPlan, finishBuildingOwn };
}
