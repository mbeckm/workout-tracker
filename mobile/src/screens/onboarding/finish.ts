import { useRouter } from 'expo-router';
import { useCallback, useRef } from 'react';

import { emptyPlanWithDays } from '@/catalog/templates';
import type { Finish } from '@/domain/finish';
import type { WorkoutPlan } from '@/domain/types';
import { deviceHref } from '@/device/device-state';
import { useFinish } from '@/device/finish';
import { openPaywall } from '@/purchases/pro-gate';
import { useWorkoutStore } from '@/store/workout-store';
import { track } from '@/analytics/analytics';

/**
 * Plays the cartridge insert for the new plan on the device and resolves once it has finished
 * (or was skipped). Until Phase 6 lands it resolves at once, so the paywall follows directly.
 */
async function playPlanReady(_planId: string): Promise<void> {
  // gadget: Phase 6 insert — `await activatePlanWithInsert(_planId, 'onboarding')` from `useActivation()`.
}

/**
 * The onboarding → app boundary is a one-way door. Each finish, in one tap:
 * 1. saves the plan and completes onboarding (one batched snapshot, so a kill never
 *    leaves a plan without completed onboarding, or the reverse);
 * 2. replaces the onboarding stack with the device, so Back can never re-enter it;
 * 3. opens what comes next: "Plan ready" (the insert) then the soft paywall, or the editor sheet.
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
        await playPlanReady(plan.id);
        if (isPro) {
          keepFinish(lockedFinish ?? savedFinish);
          return;
        }
        const outcome = await openPaywall('onboarding');
        const bought = outcome === 'purchased' || outcome === 'restored';
        keepFinish(lockedFinish && bought ? lockedFinish : savedFinish);
      })();
    },
    [completeOnboarding, isPro, keepFinish, router, savePlan, savedFinish, userName],
  );

  /**
   * Build my own: the device with the editor sheet up, opened as a new plan so it gets Done and
   * the "Plan created" confirmation like every other new plan. No onboarding paywall, so a
   * previewed Pro finish falls back. `emptyPlanWithDays` is exempt from the a-lift-first rule.
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
      // The device with the editor sheet up, as a new plan (`?sheet=editor&planId&new=1`).
      router.replace(deviceHref({ sheet: 'editor', params: { planId: plan.id, new: '1' } }));
    },
    [completeOnboarding, keepFinish, router, savePlan, savedFinish, userName],
  );

  return { finishWithPlan, finishBuildingOwn };
}
