import { useRouter } from 'expo-router';
import { useCallback, useRef } from 'react';

import { emptyPlanWithDays } from '@/catalog/templates';
import type { Finish } from '@/domain/finish';
import type { WorkoutPlan } from '@/domain/types';
import { useInsertMoment } from '@/device/activation';
import { isProFinish } from '@/device/finish-swatch';
import { useDevice } from '@/device/device-context';
import { useTour } from '@/device/tour/tour-context';
import { setTourHandoff } from '@/device/tour/tour-done';
import { useFinish } from '@/device/finish';
import { useWorkoutStore } from '@/store/workout-store';
import { track } from '@/analytics/analytics';

/**
 * The onboarding → app boundary is a one-way door. Each finish, in one tap:
 * 1. saves the plan and completes onboarding (one batched snapshot, so a kill never
 *    leaves a plan without completed onboarding, or the reverse);
 * 2. replaces the onboarding stack with the device, so Back can never re-enter it;
 * 3. plays "Plan ready" (the cartridge insert on the device, D12) and, once it has ended (played,
 *    skipped, Reduce Motion or backgrounded), the guided tour (decision 85: a practice set, then
 *    the gift of Graphite); once that's kept: Home (template and import paths), or the editor sheet
 *    (Build my own). No paywall at the end of onboarding any more (decision 97): the gift's
 *    Try Trim Pro, the first completed workout and the Pro gates sell Trim Pro instead. Never two
 *    moments at once.
 *
 * The finish (D3): a free finish was saved when it was picked. A locked one is only previewed;
 * it stays for an owner who is already Pro, otherwise the gift's pick (saved by the tour) stands.
 *
 * The root layout's redirect effect does not act on a completion that happens during
 * this launch, so it never replaces the editor opened here.
 */
export function useFinishOnboarding() {
  const router = useRouter();
  const { savePlan, completeOnboarding, isPro, userName, setFinish, finish: savedFinish } = useWorkoutStore();
  const { setPreview } = useFinish();
  const { openSheet } = useDevice();
  // The plan is already active (saved with `activate`), so the moment plays without Use plan's gates.
  const playPlanReady = useInsertMoment();
  const { run: runTour } = useTour();
  const finished = useRef(false);

  const keepFinish = useCallback(
    (finish: Finish) => {
      setFinish(finish);
      setPreview(null);
      track('finish_selected', { finish, from: savedFinish, source: 'onboarding', pro: isProFinish(finish) });
    },
    [setFinish, setPreview],
  );

  /**
   * Template and import paths: the plan loads into the device ("Plan ready"), then the tour, then
   * Home. An imported plan is a real plan like a template's (decision 88).
   */
  const finishWithPlan = useCallback(
    (plan: WorkoutPlan, lockedFinish: Finish | null, path: 'template' | 'import' = 'template') => {
      if (finished.current) {
        return;
      }
      finished.current = true;
      savePlan(plan, { activate: true });
      completeOnboarding();
      track('onboarding_completed', {
        path,
        days_per_week: plan.days.length,
        has_name: userName !== '',
      });
      setTourHandoff(true);
      router.replace('/');
      void (async () => {
        await playPlanReady(plan.id, 'onboarding');
        // The tour's reward saved the finish the owner left it on; only a Pro finish previewed
        // in onboarding and then bought replaces it.
        await runTour(plan);
        if (isPro && lockedFinish) keepFinish(lockedFinish);
      })();
    },
    [completeOnboarding, isPro, keepFinish, playPlanReady, router, runTour, savePlan, userName],
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
      setTourHandoff(true);
      router.replace('/');
      void (async () => {
        await playPlanReady(plan.id, 'onboarding');
        await runTour(plan);
        openSheet('editor', { planId: plan.id, new: '1' });
      })();
    },
    [completeOnboarding, keepFinish, openSheet, playPlanReady, router, runTour, savePlan, savedFinish, userName],
  );

  return { finishWithPlan, finishBuildingOwn };
}
