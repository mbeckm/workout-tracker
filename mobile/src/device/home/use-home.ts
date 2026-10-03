import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { showToast } from '@/components/toast';
import { useDevice } from '@/device/device-context';
import { homeModel, type HomeModel } from '@/device/home-model';
import { startOfLocalWeek } from '@/domain/plan-loop';
import { DEVICE } from '@/motion';
import { useStartDay } from '@/navigation/start-day';
import { homeDemoMode } from '@/store/home-demo';
import { useWorkoutStore } from '@/store/workout-store';

/** The stamp and the lamp flicker have both finished by then (SPEC §7). */
const CELEBRATE_MS =
  Math.max(DEVICE.STAMP_DELAY + DEVICE.STAMP, DEVICE.LAMP_LIT_DELAY + DEVICE.LAMP_LIT) + DEVICE.DISPLAY;

/**
 * The clock Home's week runs on: refreshed when the app comes to the foreground and at local
 * midnight, so the week turns over on Monday while the app is open (PLAN §7 Home and week).
 */
function useLocalNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(new Date());
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    // A second past midnight, so the new day is certainly in.
    const timer = setTimeout(() => setNow(new Date()), midnight.getTime() - Date.now() + 1000);
    return () => clearTimeout(timer);
  }, [now]);
  return now;
}

/** Development: `EXPO_PUBLIC_HOME_DEMO=*-trained` plays the stamp once per launch, as after a receipt. */
let demoStampPlayed = false;

export type HomeController = {
  model: HomeModel;
  /** The day stamping in right now (a workout just finished), or null. */
  celebrateDayId: string | null;
  pickDay: (dayId: string) => void;
  /** The big key: Start the selected day, or Plans when the slot is empty. */
  start: () => void;
  startLabel: string;
  startAccessibilityLabel: string;
};

/** Everything the device shows on Home (W1), and what its keys do. */
export function useHome(): HomeController {
  const store = useWorkoutStore();
  const { activePlan: plan, plans, workoutHistory: history, nextDayIndex, isHydrated } = store;
  const { mode, state, open, openSheet, clearJustFinished, markJustFinished } = useDevice();
  const startDay = useStartDay();
  const now = useLocalNow();

  // A tapped row holds until the week moves (a workout lands, the plan or the week changes).
  const weekStartMs = startOfLocalWeek(now).getTime();
  const anchor = `${plan?.id ?? ''}|${history[0]?.id ?? ''}|${weekStartMs}`;
  const [pick, setPick] = useState<{ dayId: string; anchor: string } | null>(null);
  const pickedDayId = pick?.anchor === anchor ? pick.dayId : null;

  // A just-finished day stamps in once Home is in front again (the receipt has closed).
  const finished = state.justFinished;
  const homeVisible = mode === 'home' && state.sheet == null;
  const celebrateDayId = finished && homeVisible ? finished.dayId : null;
  const playedRef = useRef<number | null>(null);
  useEffect(() => {
    if (!finished) return;
    if (homeVisible) {
      playedRef.current = finished.id;
      const timer = setTimeout(() => clearJustFinished(finished), CELEBRATE_MS);
      return () => clearTimeout(timer);
    }
    // Interrupted by a sheet: it has played; don't play it again when the sheet closes.
    if (playedRef.current === finished.id) clearJustFinished(finished);
  }, [finished, homeVisible, clearJustFinished]);

  useEffect(() => {
    const demo = homeDemoMode();
    if (!__DEV__ || demoStampPlayed || !isHydrated || !(demo?.endsWith('-trained') || demo === 'gadget-stamped')) return;
    const dayId = history[0]?.dayId;
    if (dayId) {
      demoStampPlayed = true;
      markJustFinished(dayId);
    }
  }, [history, isHydrated, markJustFinished]);

  const model = useMemo(
    () =>
      homeModel({
        plans,
        plan,
        history,
        now,
        fallbackNextDayIndex: nextDayIndex,
        pickedDayId,
        justFinishedDayId: celebrateDayId,
      }),
    [plans, plan, history, now, nextDayIndex, pickedDayId, celebrateDayId],
  );

  const pickDay = useCallback((dayId: string) => setPick({ dayId, anchor }), [anchor]);

  const selected = model.kind === 'plan' ? model.rows[model.selectedIndex] : undefined;
  const start = useCallback(() => {
    if (model.kind === 'empty' || !plan) {
      openSheet('plans');
      return;
    }
    const day = selected ? plan.days[selected.dayIndex] : undefined;
    if (!day) return;
    if (day.exercises.length === 0) {
      showToast({ title: 'Add lifts to this day first' });
      open({ sheet: 'editor', params: { planId: plan.id, dayId: day.id } });
      return;
    }
    startDay(plan, day);
  }, [model.kind, open, openSheet, plan, selected, startDay]);

  if (model.kind === 'empty') {
    return { model, celebrateDayId, pickDay, start, startLabel: 'Plans', startAccessibilityLabel: 'Plans' };
  }
  return {
    model,
    celebrateDayId,
    pickDay,
    start,
    startLabel: 'Start',
    startAccessibilityLabel: selected ? `Start ${selected.title}` : 'Start',
  };
}
