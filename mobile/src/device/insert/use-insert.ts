import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  cancelAnimation,
  Easing,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { isCartridgeInsertAvailable } from '../../../modules/trim-device';
import { showToast } from '@/components/toast';
import { useDevice } from '@/device/device-context';
import type { LoadingTarget } from '@/device/device-state';
import { useHaptics, useSounds } from '@/device/haptics';
import type { LampState } from '@/device/parts';
import { activatedToast, dayDisplayName, planDisplayName } from '@/device/plans-model';
import { DEVICE } from '@/motion';
import { useWorkoutStore } from '@/store/workout-store';

import { insertDone } from './insert-done';
import { T } from './timeline';

/** Who draws the scene: the SceneKit view, the JS 2.5D version, or nobody (Reduce Motion). */
export type InsertEngine = 'native' | 'js' | 'none';

export type InsertDay = { title: string; lifts: number };

export type InsertController = {
  loading: LoadingTarget;
  engine: InsertEngine;
  /** `scene` while the device is turned away, `ticking` face-on while the days load. */
  phase: 'scene' | 'ticking';
  planName: string;
  days: InsertDay[];
  /** `SLOT EMPTY / INSERT PLAN` until the click, then `LOADED`. */
  display: 'empty' | 'loaded';
  /** Days ticked in so far. */
  ticked: number;
  /** The rocker's lamps: they flick across at the click, then light as the days tick. */
  lamps: LampState[];
  /** The JS insert's clock in ms (`timeline.ts`); null for the other engines. */
  clock: SharedValue<number> | null;
  /** The native scene is up and drawing: the JS device hides under it. */
  nativeShowing: boolean;
  /** Onboarding: a dark curtain over the device until the native scene is fully in. */
  curtain: boolean;
  /** Development: freeze the native view's timeline here. */
  pauseAt?: number;
  speed?: number;
  /** Tap anywhere (D22): the scene skips to face-on; while ticking, straight to Home. */
  skip: () => void;
  onNativeReady: () => void;
  onNativeSeated: () => void;
  onNativeFinished: () => void;
};

/**
 * The plan insert (PLAN Phase 6.6, SPEC §7 Plan activation): runs while the device is in
 * `loading`. The SceneKit view plays it when the build has it; otherwise (web, an older build,
 * or the view never drawing) the JS 2.5D version; with Reduce Motion, nobody: the device goes
 * straight to `LOADED` with the click's haptic and sound. Then, face-on, the days tick in
 * (190 ms apart, a tick each) and the lamps light, then Home and the toast. Backgrounding the
 * app mid-moment finishes it at once on return, so the device is never left in `loading`.
 */
export function useInsert(): InsertController | null {
  const { state, finishLoading } = useDevice();
  const { plans } = useWorkoutStore();
  const haptics = useHaptics();
  const sound = useSounds();
  const reduceMotion = useReducedMotion();
  const loading = state.uiMode === 'loading' ? state.loading : null;
  const plan = loading ? plans.find((item) => item.id === loading.planId) : undefined;

  const planName = plan ? planDisplayName(plan) : '';
  const daysKey = plan ? plan.days.map((day, index) => `${dayDisplayName(day, index)}\u0000${day.exercises.length}`).join('\u0001') : '';
  const days = useMemo<InsertDay[]>(
    () =>
      daysKey
        ? daysKey.split('\u0001').map((row) => {
            const [title, lifts] = row.split('\u0000');
            return { title, lifts: Number(lifts) };
          })
        : [],
    [daysKey],
  );

  const clock = useSharedValue(0);
  const [run, setRun] = useState<{
    id: number;
    engine: InsertEngine;
    phase: 'scene' | 'ticking';
    display: 'empty' | 'loaded';
    ticked: number;
    lamps: LampState[];
    nativeShowing: boolean;
    /** Onboarding: dark over the device until the native scene has faded in, so Home never flashes. */
    curtain: boolean;
  } | null>(null);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const seated = useRef(false);
  const done = useRef(false);
  const startedAt = useRef(0);
  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);
  const clearTimers = useCallback(() => {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current = [];
  }, []);

  const latest = useRef({ loading, plan, days, haptics, sound });
  useEffect(() => {
    latest.current = { loading, plan, days, haptics, sound };
  });

  /** Home, and the toast. Once per run. */
  const finish = useCallback(() => {
    const { loading: current, plan: currentPlan } = latest.current;
    if (!current || done.current) return;
    done.current = true;
    clearTimers();
    cancelAnimation(clock);
    clock.set(0);
    finishLoading(current);
    // The machine is ready: a celebratory chime and haptic as Home takes over.
    latest.current.haptics.planReady();
    if (currentPlan && !current.quiet) showToast({ title: activatedToast(currentPlan) });
    insertDone();
  }, [clearTimers, clock, finishLoading]);

  /** Face-on: the days tick in, the lamps light, then Home. */
  const tick = useCallback(() => {
    clearTimers();
    const n = latest.current.days.length;
    setRun((current) =>
      current ? { ...current, phase: 'ticking', display: 'loaded', nativeShowing: false, curtain: false, lamps: current.lamps.map(() => 'off') } : current,
    );
    for (let i = 0; i < n; i += 1) {
      later(DEVICE.INSERT_TICK_START + i * DEVICE.INSERT_DAY_TICK, () => {
        latest.current.haptics.dayTick();
        setRun((current) =>
          current
            ? {
                ...current,
                ticked: i + 1,
                lamps: current.lamps.map((lamp, index) => (index <= i ? 'on' : lamp)),
              }
            : current,
        );
      });
    }
    later(DEVICE.INSERT_TICK_START + n * DEVICE.INSERT_DAY_TICK + DEVICE.INSERT_HOME_DELAY, finish);
  }, [clearTimers, finish, later]);

  /** The click: haptic and sound (unless the native view played them), `LOADED`, the lamps flick across. */
  const seat = useCallback(
    (feedback: boolean, speed = 1) => {
      if (seated.current) return;
      seated.current = true;
      if (feedback) {
        latest.current.haptics.cartridgeClick();
        latest.current.sound('cartridge');
      }
      setRun((current) => (current ? { ...current, display: 'loaded' } : current));
      const n = latest.current.days.length;
      for (let i = 0; i < n; i += 1) {
        const on = (DEVICE.INSERT_LAMP_FIRST + i * DEVICE.INSERT_LAMP_STEP) / speed;
        const light = (lamp: LampState) => (index: number) =>
          setRun((current) =>
            current && current.phase === 'scene'
              ? { ...current, lamps: current.lamps.map((value, at) => (at === index ? lamp : value)) }
              : current,
          );
        later(on, () => light('on')(i));
        later(on + DEVICE.INSERT_LAMP_ON / speed, () => light('off')(i));
      }
    },
    [later],
  );

  // A new `loading`: pick the engine and start.
  const loadingId = loading?.id ?? null;
  useEffect(() => {
    if (loadingId == null) return;
    const { loading: current, days: currentDays } = latest.current;
    if (!current) return;
    done.current = false;
    seated.current = false;
    startedAt.current = Date.now();
    clearTimers();
    const dev = __DEV__ ? current.dev : undefined;
    const engine: InsertEngine = dev?.engine
      ? dev.engine === 'native' && !isCartridgeInsertAvailable
        ? 'js'
        : dev.engine
      : reduceMotion
        ? 'none'
        : isCartridgeInsertAvailable
          ? 'native'
          : 'js';
    setRun({
      id: loadingId,
      engine,
      phase: 'scene',
      display: 'empty',
      ticked: 0,
      lamps: currentDays.map(() => 'off'),
      nativeShowing: false,
      curtain: engine === 'native',
    });
    if (engine === 'none') {
      seat(true);
      tick();
      return;
    }
    if (engine === 'native') {
      // The view never drew (a broken build): play the JS version instead.
      later(DEVICE.INSERT_NATIVE_TIMEOUT, () =>
        setRun((value) => (value && value.engine === 'native' && !value.nativeShowing && value.phase === 'scene' ? { ...value, engine: 'js', curtain: false } : value)),
      );
      return;
    }
    // Clean up on unmount happens below; this run is started by the effect on `engine` changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingId]);

  // The JS clock: one linear run 0 → end, events alongside it. Also takes over from a native view that never drew.
  const jsRunId = run && run.engine === 'js' && run.phase === 'scene' ? run.id : null;
  useEffect(() => {
    if (jsRunId == null) return;
    const dev = __DEV__ ? latest.current.loading?.dev : undefined;
    const speed = dev?.speed && dev.speed > 0 ? dev.speed : 1;
    if (dev?.pauseAt != null) {
      clock.set(Math.max(1, Math.min(dev.pauseAt, T.end - 1)));
      if (dev.pauseAt >= T.seat) seat(false, speed);
      return;
    }
    clock.set(0);
    clock.set(withTiming(T.end, { duration: T.end / speed, easing: Easing.linear }));
    later(T.seat / speed, () => seat(true, speed));
    later(T.end / speed, tick);
  }, [jsRunId, clock, later, seat, tick]);

  // Back from the background mid-moment: finish at once (PLAN §7 System).
  const active = run != null;
  useEffect(() => {
    if (!active) return;
    let wentAway = false;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'background') wentAway = true;
      if (next === 'active' && wentAway) finish();
    });
    return () => subscription.remove();
  }, [active, finish]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const skip = useCallback(() => {
    // The second tap of a double tap on Use plan lands here while the sheet is still leaving:
    // it isn't a skip (PLAN §7: re-entry is ignored).
    if (!run || Date.now() - startedAt.current < DEVICE.SHEET) return;
    if (run.phase === 'ticking') {
      finish();
      return;
    }
    clearTimers();
    cancelAnimation(clock);
    clock.set(0);
    seat(!seated.current);
    tick();
  }, [clearTimers, clock, finish, run, seat, tick]);

  const onNativeReady = useCallback(() => {
    setRun((current) => (current && current.engine === 'native' && current.phase === 'scene' ? { ...current, nativeShowing: true } : current));
    // The scene fades in over INSERT_SCENE; the curtain lifts once it's fully there.
    later(DEVICE.INSERT_SCENE, () => setRun((current) => (current ? { ...current, curtain: false } : current)));
  }, [later]);
  // The native view plays the click's haptic and sound itself.
  const onNativeSeated = useCallback(() => seat(false), [seat]);
  const onNativeFinished = useCallback(() => {
    if (run?.engine === 'native' && run.phase === 'scene') tick();
  }, [run, tick]);

  if (!loading || !run || run.id !== loading.id) return null;
  const dev = __DEV__ ? loading.dev : undefined;
  return {
    loading,
    engine: run.engine,
    phase: run.phase,
    planName,
    days,
    display: run.display,
    ticked: run.ticked,
    lamps: run.lamps,
    clock: run.engine === 'js' ? clock : null,
    nativeShowing: run.nativeShowing,
    curtain: run.curtain,
    pauseAt: dev?.pauseAt,
    speed: dev?.speed,
    skip,
    onNativeReady,
    onNativeSeated,
    onNativeFinished,
  };
}
