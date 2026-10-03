import { useCallback, useEffect, useRef } from 'react';

import { track } from '@/analytics/analytics';
import { showToast } from '@/components/toast';
import { useDevice } from '@/device/device-context';
import { activatedToast } from '@/device/plans-model';
import { DEVICE } from '@/motion';
import { useWorkoutStore } from '@/store/workout-store';

export type ActivationSource = 'rack' | 'onboarding';

/** A second tap while the first activation is still closing the sheet is ignored (PLAN §7 Plans). */
let activatingUntil = 0;

/**
 * Putting a plan in the slot (PLAN Phase 6.6, D8). For now: the store's `activatePlan`, the
 * `plan_activated` event, the sheet closes and the toast `<Plan> is your plan`. The 3D insert
 * (SPEC §7, Phase 9's native view or the JS 2.5D fallback) goes in front of the toast here,
 * so every caller (the editor's Use plan, onboarding) gets it without changing.
 *
 * The gates (open workout, no lifts, `switch_plan`) are the caller's: onboarding's Build my own
 * activates a plan with no lifts on purpose (D12).
 */
export function useActivation(): {
  activatePlanWithInsert: (planId: string, source: ActivationSource) => void;
} {
  const { plans, activatePlan } = useWorkoutStore();
  const { closeSheet } = useDevice();
  const plansRef = useRef(plans);
  useEffect(() => {
    plansRef.current = plans;
  }, [plans]);

  const activatePlanWithInsert = useCallback(
    (planId: string, source: ActivationSource) => {
      const now = Date.now();
      const plan = plansRef.current.find((item) => item.id === planId);
      if (!plan || now < activatingUntil) {
        return;
      }
      activatingUntil = now + DEVICE.SHEET;
      activatePlan(plan);
      track('plan_activated', { source });
      closeSheet();
      showToast({ title: activatedToast(plan) });
    },
    [activatePlan, closeSheet],
  );

  return { activatePlanWithInsert };
}
