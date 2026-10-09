import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { track } from '@/analytics/analytics';
import { BUNDLED_EXERCISES } from '@/catalog/bundled';
import { exercisePickerMeta } from '@/catalog/sections';
import { offlineCatalogExercises } from '@/catalog/service';
import { useDevice } from '@/device/device-context';
import { useFinish } from '@/device/finish';
import { useHaptics } from '@/device/haptics';
import { alternativesFor } from '@/device/log/log-state';
import { EARNED_FINISH, finishLock, type Finish } from '@/domain/finish';
import { defaultLoadStep } from '@/domain/load-step';
import { trainableDays } from '@/domain/plan-loop';
import type { ExercisePrescription } from '@/domain/types';
import { DEVICE } from '@/motion';
import { useWorkoutStore } from '@/store/workout-store';

import { tourDone, tourHandoffPending, setTourHandoff, whenTourDone } from './tour-done';
import {
  initialTourState,
  lineOf,
  litControl,
  swapTarget,
  taught,
  tourReducer,
  type TourAction,
  type TourControl,
  type TourLift,
  type TourState,
  type TourWait,
} from './tour-model';

/** The launch after Start: in the air, perched over the picker, then settling to full size. */
export type TourLaunchPhase = 'launch' | 'perched' | 'landing';

/** The practice lifts when the plan has none yet (Build my own): a push day's first three. */
const FALLBACK_LIFTS = ['Flat Barbell Bench Press', 'Incline Dumbbell Press', 'Overhead Press'];
const PRACTICE_LIFTS = 3;

type TourContextValue = {
  /** True while the tour owns the device (its practice set, the end, the launch). */
  active: boolean;
  state: TourState;
  /** The line on the display so far, and the whole line. */
  line: string;
  typedLine: string;
  /** The control the current line names, once it's typed (its focus ring). */
  lit: TourWait | null;
  taught: (control: TourControl) => boolean;
  dispatch: (action: TourAction) => void;
  /** The wheel's step for the current practice lift. */
  loadStep: number;
  /** Seconds left in the practice rest. */
  restLeft: number;
  /** The practice lift's prescription (the exercise sheet shows it). */
  current: ExercisePrescription | null;
  alternatives: readonly ExercisePrescription[];
  /** The alternative the swap beat asks for. */
  target: ExercisePrescription | null;
  /** Plays the tour from the start; resolves once the reward is chosen and the device is home. */
  run: () => Promise<void>;
  /** The launch and the reward picker. */
  launch: TourLaunchPhase | null;
  pick: Finish;
  ripple: number;
  /** The finish the owner had before the reward (the picker's first swatch). */
  before: Finish;
  start: () => void;
  /**
   * The 3D launch has the device photographed and hidden: dress it in the new finish now, during
   * the crouch, so the re-skin's work lands while the body barely moves. The 3D body shows it
   * edge-on at `DEVICE.TOUR_SWAP`, as the 2D slab does.
   */
  dressEarly: () => void;
  choose: (finish: Finish) => void;
  keep: () => void;
};

const TourContext = createContext<TourContextValue | null>(null);

function prescriptionByName(name: string): ExercisePrescription | undefined {
  return BUNDLED_EXERCISES.find((item) => item.name === name);
}

/**
 * The guided tour (decision 85), above the device and its sheets so the onboarding hand-off can
 * run it and the exercise and menu sheets can read it. Owns the practice set (never logged), the
 * typing, the rest clock and the launch; `device-screen.tsx` draws it and wires the keys.
 */
export function TourProvider({ children }: { children: ReactNode }) {
  const { state: device, setUiMode, closeSheet } = useDevice();
  const store = useWorkoutStore();
  const { setPreview } = useFinish();
  const haptics = useHaptics();
  const facts = useMemo(() => ({ name: store.userName }), [store.userName]);
  const [tour, setTour] = useState<TourState | null>(null);
  const [practice, setPractice] = useState<ExercisePrescription[]>([]);
  const [launch, setLaunch] = useState<TourLaunchPhase | null>(null);
  const [pick, setPick] = useState<Finish>(EARNED_FINISH);
  const [ripple, setRipple] = useState(0);
  const [before, setBefore] = useState<Finish>(store.finish);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const factsRef = useRef(facts);
  useEffect(() => {
    factsRef.current = facts;
  }, [facts]);
  const active = tour != null && device.uiMode === 'tour';

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const dispatch = useCallback((action: TourAction) => {
    setTour((current) => (current ? tourReducer(current, action, factsRef.current) : current));
  }, []);

  const practiceLifts = useCallback((): ExercisePrescription[] => {
    const plan = store.activePlan;
    const fromPlan = plan ? (trainableDays(plan)[0]?.exercises ?? []).slice(0, PRACTICE_LIFTS) : [];
    if (fromPlan.length > 0) return fromPlan;
    return FALLBACK_LIFTS.map(prescriptionByName).filter((item): item is ExercisePrescription => item != null);
  }, [store.activePlan]);

  const run = useCallback(() => {
    setTourHandoff(false);
    const lifts = practiceLifts();
    const pool = offlineCatalogExercises(store.customExercises);
    const withAlternatives: TourLift[] = lifts.map((lift) => ({
      id: lift.id,
      name: lift.name,
      alternatives: alternativesFor(lift, pool).map((item) => ({ id: item.id, name: item.name, meta: exercisePickerMeta(item) })),
    }));
    setPractice([...lifts, ...lifts.flatMap((lift) => alternativesFor(lift, pool))]);
    setTour(initialTourState(withAlternatives));
    setLaunch(null);
    setBefore(store.finish);
    setPick(EARNED_FINISH);
    setRipple(0);
    closeSheet();
    setUiMode('tour');
    track('tour_started', {});
    return whenTourDone();
  }, [closeSheet, practiceLifts, setUiMode, store.customExercises, store.finish]);

  // Typing: one character at a time while a line is incomplete.
  const line = tour ? lineOf(tour.beat, facts) : '';
  const typing = active && launch == null && tour != null && tour.typed < line.length;
  useEffect(() => {
    if (!typing) return;
    const delay = tour?.typed === 0 ? DEVICE.TOUR_BEAT : DEVICE.TOUR_TYPE;
    const timer = setTimeout(() => dispatch({ type: 'type' }), delay);
    return () => clearTimeout(timer);
  }, [dispatch, tour?.typed, tour?.beat, typing]);

  // The practice rest counts down for real.
  const [restLeft, setRestLeft] = useState(0);
  const restEndsAt = active && tour?.screen === 'rest' ? tour.restEndsAt : 0;
  useEffect(() => {
    if (restEndsAt <= 0) return;
    const read = () => setRestLeft(Math.max(0, Math.ceil((restEndsAt - Date.now()) / 1000)));
    const first = setTimeout(read, 0);
    const timer = setInterval(read, DEVICE.REST_TICK);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [restEndsAt]);

  // The menu beat ends when the menu the tour opened closes.
  const menuWasOpen = useRef(false);
  useEffect(() => {
    if (!active || tour?.beat == null) return;
    const open = device.sheet?.kind === 'menu';
    if (open) {
      menuWasOpen.current = true;
    } else if (menuWasOpen.current) {
      menuWasOpen.current = false;
      dispatch({ type: 'menuClosed' });
    }
  }, [active, device.sheet, dispatch, tour?.beat]);

  // A cold launch after onboarding but before the tour ended starts it again (the reward is owed).
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || !store.isHydrated) return;
    if (!store.hasCompletedOnboarding || store.tourDone) {
      resumed.current = true;
      return;
    }
    if (tourHandoffPending() || device.uiMode != null || store.activeSession != null) return;
    resumed.current = true;
    const timer = setTimeout(() => void run(), 0);
    return () => clearTimeout(timer);
  }, [device.uiMode, run, store.activeSession, store.hasCompletedOnboarding, store.isHydrated, store.tourDone]);

  const start = useCallback(() => {
    if (launch != null) return;
    closeSheet();
    haptics.bigKeyPress();
    setLaunch('launch');
    // The new finish swaps in while the device is edge-on, mid-spin.
    later(() => {
      setPick(EARNED_FINISH);
      setPreview(EARNED_FINISH);
    }, DEVICE.TOUR_SWAP);
    later(() => {
      setLaunch('perched');
      haptics.stamp();
    }, DEVICE.TOUR_LAUNCH);
  }, [closeSheet, haptics, later, launch, setPreview]);

  const dressEarly = useCallback(() => {
    if (launch === 'launch') setPreview(EARNED_FINISH);
  }, [launch, setPreview]);

  const choose = useCallback(
    (finish: Finish) => {
      if (finish === pick || launch === 'landing') return;
      haptics.reskin();
      setPick(finish);
      setPreview(finish === store.finish ? null : finish);
      setRipple((n) => n + 1);
    },
    [haptics, launch, pick, setPreview, store.finish],
  );

  const finishTour = useCallback(
    (keepFinish: Finish) => {
      setLaunch('landing');
      store.completeTour(keepFinish);
      setPreview(null);
      track('tour_completed', { finish: keepFinish });
      later(() => {
        setLaunch(null);
        setTour(null);
        setUiMode(null);
        tourDone();
      }, DEVICE.TOUR_SETTLE);
    },
    [later, setPreview, setUiMode, store],
  );

  const keep = useCallback(() => {
    if (launch !== 'perched') return;
    // Pro finishes only preview: the owner keeps the earned one or the one they had.
    if (finishLock(pick, { isPro: store.isPro, tourDone: true }) === 'pro') return;
    finishTour(pick);
  }, [finishTour, launch, pick, store.isPro]);

  const state = tour ?? initialTourState([]);
  const currentLift = state.lifts[state.lift];
  const current = useMemo(
    () => (currentLift ? (practice.find((item) => item.id === currentLift.id) ?? null) : null),
    [currentLift, practice],
  );
  const alternatives = useMemo(
    () =>
      (currentLift?.alternatives ?? [])
        .map((alt) => practice.find((item) => item.id === alt.id))
        .filter((item): item is ExercisePrescription => item != null),
    [currentLift, practice],
  );
  const targetId = swapTarget(state)?.id;
  const target = alternatives.find((item) => item.id === targetId) ?? null;
  const loadStep = current ? defaultLoadStep(current, store.units) : 2.5;

  const value = useMemo<TourContextValue>(
    () => ({
      active,
      state,
      line,
      typedLine: line.slice(0, state.typed),
      lit: active && launch == null ? litControl(state, facts) : null,
      taught: (control: TourControl) => taught(state, control),
      dispatch,
      restLeft,
      loadStep,
      current,
      alternatives,
      target,
      run,
      launch: active ? launch : null,
      pick,
      ripple,
      before,
      start,
      dressEarly,
      choose,
      keep,
    }),
    [active, alternatives, before, choose, current, dispatch, dressEarly, facts, keep, launch, line, loadStep, pick, restLeft, ripple, run, start, state, target],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): TourContextValue {
  const value = useContext(TourContext);
  if (!value) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return value;
}
