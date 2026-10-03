import { useCallback, useEffect, useRef } from 'react';

import { track } from '@/analytics/analytics';
import { showToast } from '@/components/toast';
import { useDevice } from '@/device/device-context';
import { whenInsertDone } from '@/device/insert/insert-done';
import { DEVICE } from '@/motion';
import { useWorkoutStore } from '@/store/workout-store';

export type ActivationSource = 'rack' | 'onboarding';

/** A second tap in the same frame (before `loading` renders) is ignored too (PLAN §7 Plans). */
let activatingUntil = 0;

/**
 * The moment alone, for a plan that is already active (onboarding's "Plan ready", D12): the
 * `plan_activated` event, then the device enters `loading`, which closes any sheet and plays the
 * insert (`device/insert`: the SceneKit view, the JS 2.5D version, or straight to `LOADED` with
 * Reduce Motion), the days ticking in, Home and the toast `<Plan> is your plan`. Resolves when
 * that has ended (played, skipped or interrupted), so the next moment can follow. No gates.
 */
export function useInsertMoment(): (planId: string, source: ActivationSource) => Promise<void> {
  const { startLoading } = useDevice();
  return useCallback(
    (planId: string, source: ActivationSource) => {
      track('plan_activated', { source });
      const done = whenInsertDone();
      // Onboarding's paywall ("Your plan is ready") or the editor says it; no toast on top.
      startLoading(planId, undefined, source === 'onboarding');
      // Never left waiting, whatever happened to the device.
      return Promise.race([done, new Promise<void>((resolve) => setTimeout(resolve, DEVICE.INSERT_MAX_WAIT))]);
    },
    [startLoading],
  );
}

/**
 * Use plan (PLAN Phase 6.6, D8): the store's `activatePlan`, then the insert moment.
 *
 * Never during an open workout (`Finish your workout first`), and a second activation while one
 * is loading is ignored. The other gates (no lifts, `switch_plan`) are the caller's.
 */
export function useActivation(): {
  activatePlanWithInsert: (planId: string, source: ActivationSource) => void;
} {
  const { plans, activeSession, activatePlan } = useWorkoutStore();
  const { state } = useDevice();
  const playInsert = useInsertMoment();
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
      void playInsert(plan.id, source);
    },
    [activatePlan, playInsert],
  );

  return { activatePlanWithInsert };
}
