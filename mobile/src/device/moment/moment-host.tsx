import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { track } from '@/analytics/analytics';
import { useDevice } from '@/device/device-context';
import type { DeviceCommand } from '@/device/device-state';
import { afterDoneSteps, weekReport, type AfterDoneStep, type WeekReport } from '@/device/moments';
import { openPaywall } from '@/purchases/pro-gate';
import { useWorkoutStore } from '@/store/workout-store';

import { WeekMoment } from './week-moment';

/** The device command that prints a just-finished workout's receipt (D7). */
export function freshReceiptCommand(workoutId: string): DeviceCommand {
  return { sheet: 'receipt', params: { workoutId, fresh: '1' } };
}

let opener: ((command: DeviceCommand) => void) | null = null;
let waiting: DeviceCommand | null = null;

/**
 * Phase 4's finish hook calls this right after `finish()` (`completeWorkout` has run): the
 * receipt prints over Home. When it closes (Done, a swipe, the scrim), `MomentHost` plays the
 * Home stamp, then the week moment if this workout filled the week, then the post-workout
 * paywall, one at a time. Callable from anywhere; before the device mounts it waits for it.
 */
export function openReceiptAfterFinish(workoutId: string): void {
  const command = freshReceiptCommand(workoutId);
  if (opener) {
    opener(command);
  } else {
    waiting = command;
  }
}

/**
 * Runs what plays after a fresh receipt (trim-ui §12 Moments: one at a time, after the action
 * lands): it notices the fresh receipt closing, asks `afterDoneSteps` for the queue and plays
 * each step once Home is in front. Renders the week moment above the sheets. Mounted once, in
 * the device screen, after `SheetHost`.
 */
export function MomentHost() {
  const { state, mode, open, markJustFinished } = useDevice();
  const store = useWorkoutStore();
  const [steps, setSteps] = useState<AfterDoneStep[]>([]);
  const [week, setWeek] = useState<WeekReport | null>(null);
  const freshRef = useRef<string | null>(null);
  const stampSeen = useRef(false);
  const startedRef = useRef<AfterDoneStep | null>(null);

  // `openReceiptAfterFinish` reaches the device through here.
  useEffect(() => {
    opener = open;
    if (waiting) {
      open(waiting);
      waiting = null;
    }
    return () => {
      if (opener === open) opener = null;
    };
  }, [open]);

  // A fresh receipt is up; when it's gone, queue what follows its Done.
  const sheet = state.sheet;
  const freshId = sheet?.kind === 'receipt' && sheet.params.fresh === '1' ? (sheet.params.workoutId ?? null) : null;
  useEffect(() => {
    if (freshId) {
      freshRef.current = freshId;
      return;
    }
    const closedId = freshRef.current;
    if (!closedId) return;
    freshRef.current = null;
    const history = store.workoutHistory;
    const workout =
      (closedId === 'latest' ? history[0] : history.find((item) => item.id === closedId)) ??
      (store.lastCompletedWorkout?.id === closedId ? store.lastCompletedWorkout : null);
    if (!workout) return;
    stampSeen.current = false;
    startedRef.current = null;
    setSteps(
      afterDoneSteps({
        workout,
        history,
        plan: store.activePlan,
        weekMomentsShown: store.weekMomentsShown,
        offerPaywall: store.shouldOfferPostWorkoutPaywall,
      }),
    );
    // Only the receipt closing starts a queue; the store's latest values are read then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freshId]);

  const homeInFront = mode === 'home' && state.sheet == null;
  const head = steps[0] ?? null;
  const finished = state.justFinished;

  useEffect(() => {
    if (!head) return;
    const next = () => {
      startedRef.current = null;
      setSteps((current) => current.slice(1));
    };
    switch (head.kind) {
      case 'stamp': {
        // Home stamps the day once it's in front, then clears `justFinished` (use-home).
        if (!stampSeen.current) {
          if (finished?.dayId === head.dayId) {
            stampSeen.current = true;
          } else {
            markJustFinished(head.dayId);
          }
          return;
        }
        if (!finished || finished.dayId !== head.dayId) {
          stampSeen.current = false;
          next();
        }
        return;
      }
      case 'week': {
        if (startedRef.current === head || !homeInFront) return;
        startedRef.current = head;
        const report = weekReport({
          history: store.workoutHistory,
          plan: store.activePlan,
          units: store.units,
          weekOf: new Date(head.weekStart),
        });
        store.markWeekMomentShown(head.weekKey);
        track('week_completed', {});
        setWeek(report);
        return;
      }
      case 'paywall': {
        if (startedRef.current === head || !homeInFront) return;
        startedRef.current = head;
        // The paywall marks the offer shown once prices render, so a failed load retries next time.
        void openPaywall('post_workout');
        next();
        return;
      }
      default: {
        const exhaustive: never = head;
        return exhaustive;
      }
    }
    // `store` changes on every write; the step reads it when it starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [head, finished, homeInFront, markJustFinished]);

  useDevWeekParam(setWeek);

  if (!week) return null;
  return (
    <WeekMoment
      key={week.weekKey}
      report={week}
      onDone={() => {
        setWeek(null);
        if (head?.kind === 'week') {
          startedRef.current = null;
          setSteps((current) => current.slice(1));
        }
      }}
    />
  );
}

/** Development: `/?moment=week` plays the latest workout's week report (nothing is recorded). */
function useDevWeekParam(show: (report: WeekReport) => void) {
  const params = useLocalSearchParams<{ moment?: string }>();
  const router = useRouter();
  const { workoutHistory, activePlan, units, isHydrated } = useWorkoutStore();
  const moment = __DEV__ ? params.moment : undefined;
  useEffect(() => {
    if (moment !== 'week' || !isHydrated) return;
    const latest = workoutHistory[0];
    show(
      weekReport({
        history: workoutHistory,
        plan: activePlan,
        units,
        weekOf: latest ? new Date(latest.completedAt) : new Date(),
      }),
    );
    router.setParams({ moment: undefined });
    // Once per link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moment, isHydrated]);
}
