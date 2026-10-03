import { useCallback, useEffect, useRef } from 'react';

import { track } from '@/analytics/analytics';
import { showToast } from '@/components/toast';
import { useDevice } from '@/device/device-context';
import { DEVICE } from '@/motion';
import { useWorkoutStore } from '@/store/workout-store';

export type ActivationSource = 'rack' | 'onboarding';

/** A second tap in the same frame (before `loading` renders) is ignored too (PLAN §7 Plans). */
let activatingUntil = 0;

/**
 * Putting a plan in the slot (PLAN Phase 6.6, D8): the store's `activatePlan`, the
 * `plan_activated` event, then the device enters `loading`, which closes the sheet and plays the
 * insert (`device/insert`: the SceneKit view, the JS 2.5D version, or straight to `LOADED` with
 * Reduce Motion), the days ticking in, Home and the toast `<Plan> is your plan`.
 *
 * Never during an open workout (`Finish your workout first`), and a second activation while one
 * is loading is ignored. The other gates (no lifts, `switch_plan`) are the caller's: onboarding's
 * Build my own activates a plan with no lifts on purpose (D12).
 */
export function useActivation(): {
  activatePlanWithInsert: (planId: string, source: ActivationSource) => void;
} {
  const { plans, activeSession, activatePlan } = useWorkoutStore();
  const { state, startLoading } = useDevice();
  const latest = useRef({ plans, activeSession, state });
  useEffect(() => {
    latest.current = { plans, activeSession, state };
  }, [plans, activeSession, state]);

  const activatePlanWithInsert = useCallback(
    (planId: string, source: ActivationSource) => {
      const now = Date.now();
      const current = latest.current;
      if (current.state.uiMode === 'loading' || now < activatingUntil) {
        return;
      }
      if (current.activeSession != null || current.state.logMode != null) {
        showToast({ title: 'Finish your workout first' });
        return;
      }
      const plan = current.plans.find((item) => item.id === planId);
      if (!plan) {
        return;
      }
      activatingUntil = now + DEVICE.SHEET;
      activatePlan(plan);
      track('plan_activated', { source });
      startLoading(plan.id);
    },
    [activatePlan, startLoading],
  );

  return { activatePlanWithInsert };
}
