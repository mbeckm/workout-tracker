import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

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
import type { ExercisePrescription, WorkoutPlan } from '@/domain/types';
import { DEVICE, REST_GO_MS } from '@/motion';
import { useWorkoutStore } from '@/store/workout-store';

import { tourDone, tourHandoffPending, setTourHandoff, whenTourDone } from './tour-done';
import {
  initialTourState,
  lineOf,
  litControl,
  swapTarget,
  taught,
  tourReducer,
  tourRestLeft,
  type TourAction,
  type TourControl,
  type TourLift,
  type TourState,
  type TourWait,
} from './tour-model';

/**
 * The gift after Start (decision 95): the old skin falls away (`drop`), the six machines stand in a
 * row to swipe through (`picking`), the picked one steps forward again (`landing`, Home already
 * underneath), and the device fades in over it (`landed`).
 */
export type TourLaunchPhase = 'drop' | 'picking' | 'landing' | 'landed';

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
  /** The practice rest reached 0:00: the battery is full and GO shows until `restOver`. */
  restGo: boolean;
  /** The practice lift's prescription (the exercise sheet shows it). */
  current: ExercisePrescription | null;
  alternatives: readonly ExercisePrescription[];
  /** The alternative the swap beat asks for. */
  target: ExercisePrescription | null;
  /**
   * Plays the tour from the start; resolves once the reward is chosen and the device is home.
   * `plan` is the plan to practise on (onboarding passes the one it just saved); without it, the
   * active plan.
   */
  run: (plan?: WorkoutPlan) => Promise<void>;
  /** The gift and its row of machines. */
  launch: TourLaunchPhase | null;
  /** The machine in the middle of the row. */
  pick: Finish;
  /** The finish the owner had before the reward (the row's first machine). */
  before: Finish;
  start: () => void;
  /** The old skin is gone (or a tap skipped its fall): the row takes touches. */
  reveal: () => void;
  choose: (finish: Finish) => void;
  keep: () => void;
};

const TourContext = createContext<TourContextValue | null>(null);

function prescriptionByName(name: string): ExercisePrescription | undefined {
  return BUNDLED_EXERCISES.find((item) => item.name === name);
}

/** The first trainable day's first lifts, or the fallback when the plan has none (Build my own). */
function practiceLifts(plan: WorkoutPlan | null): ExercisePrescription[] {
  const fromPlan = plan ? (trainableDays(plan)[0]?.exercises ?? []).slice(0, PRACTICE_LIFTS) : [];
  if (fromPlan.length > 0) return fromPlan;
  return FALLBACK_LIFTS.map(prescriptionByName).filter((item): item is ExercisePrescription => item != null);
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
  const reduceMotion = useReducedMotion();
  const facts = useMemo(() => ({ name: store.userName }), [store.userName]);
  const [tour, setTour] = useState<TourState | null>(null);
  const [practice, setPractice] = useState<ExercisePrescription[]>([]);
  const [launch, setLaunch] = useState<TourLaunchPhase | null>(null);
  const [pick, setPick] = useState<Finish>(EARNED_FINISH);
  const [before, setBefore] = useState<Finish>(store.finish);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const factsRef = useRef(facts);
  useEffect(() => {
    factsRef.current = facts;
  }, [facts]);
  // `run` is often called from a closure made before the plan was saved (onboarding's hand-off),
  // so it reads the store from here, not from the render that made it.
  const latest = useRef({ activePlan: store.activePlan, customExercises: store.customExercises, finish: store.finish });
  useEffect(() => {
    latest.current = { activePlan: store.activePlan, customExercises: store.customExercises, finish: store.finish };
  }, [store.activePlan, store.customExercises, store.finish]);
  const active = tour != null && device.uiMode === 'tour';

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const dispatch = useCallback((action: TourAction) => {
    setTour((current) => (current ? tourReducer(current, action, factsRef.current) : current));
  }, []);

  const run = useCallback(
    (plan?: WorkoutPlan) => {
      setTourHandoff(false);
      const lifts = practiceLifts(plan ?? latest.current.activePlan);
      const pool = offlineCatalogExercises(latest.current.customExercises);
      const withAlternatives: TourLift[] = lifts.map((lift) => ({
        id: lift.id,
        name: lift.name,
        alternatives: alternativesFor(lift, pool).map((item) => ({ id: item.id, name: item.name, meta: exercisePickerMeta(item) })),
      }));
      setPractice([...lifts, ...lifts.flatMap((lift) => alternativesFor(lift, pool))]);
      setTour(initialTourState(withAlternatives));
      setLaunch(null);
      setBefore(latest.current.finish);
      setPick(EARNED_FINISH);
      closeSheet();
      setUiMode('tour');
      track('tour_started', {});
      return whenTourDone();
    },
    [closeSheet, setUiMode],
  );

  // Typing: one character at a time while a line is incomplete.
  const line = tour ? lineOf(tour.beat, facts) : '';
  const typing = active && launch == null && tour != null && tour.typed < line.length;
  useEffect(() => {
    if (!typing) return;
    const delay = tour?.typed === 0 ? DEVICE.TOUR_BEAT : DEVICE.TOUR_TYPE;
    const timer = setTimeout(() => dispatch({ type: 'type' }), delay);
    return () => clearTimeout(timer);
  }, [dispatch, tour?.typed, tour?.beat, typing]);

  // The practice rest counts down for real, then hands over as the log's does (decision 96): GO
  // with the rest haptic at 0:00, and set 2 after REST_GO_MS.
  const [now, setNow] = useState(() => Date.now());
  const [goFor, setGoFor] = useState(0);
  const restEndsAt = active && tour?.screen === 'rest' ? tour.restEndsAt : 0;
  useEffect(() => {
    if (restEndsAt <= 0) return;
    const read = () => setNow(Date.now());
    const first = setTimeout(read, 0);
    const timer = setInterval(read, DEVICE.REST_TICK);
    const wait = Math.max(0, restEndsAt - Date.now());
    const go = setTimeout(() => {
      setGoFor(restEndsAt);
      haptics.restGo();
    }, wait);
    const over = setTimeout(() => dispatch({ type: 'restOver' }), wait + REST_GO_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      clearTimeout(go);
      clearTimeout(over);
    };
  }, [dispatch, haptics, restEndsAt]);
  const restGo = restEndsAt > 0 && goFor === restEndsAt;
  // Until the first tick the clock may be stale: it never reads more than the rest's length.
  const restLeft = tour && restEndsAt > 0 ? (restGo ? 0 : Math.min(tour.restLongest, tourRestLeft(tour, now))) : 0;

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

  const reveal = useCallback(() => setLaunch((phase) => (phase === 'drop' ? 'picking' : phase)), []);

  // Start lets the old skin go (decision 95). Nothing heavy happens here: the row of machines is
  // already drawn under the device (`TourGift`), so the tap only starts the fall.
  const start = useCallback(() => {
    if (launch != null) return;
    closeSheet();
    haptics.bigKeyPress();
    setPick(EARNED_FINISH);
    setLaunch('drop');
    later(() => haptics.reskin(), DEVICE.TOUR_RELEASE);
    // The fall's own end reveals the row (`useTourDropStyle`); this is the backstop.
    later(reveal, reduceMotion ? DEVICE.TOUR_FADE : DEVICE.TOUR_DROP + DEVICE.TOUR_FADE);
  }, [closeSheet, haptics, later, launch, reduceMotion, reveal]);

  // A machine in the middle of the row. Nothing is previewed on the device: it stays hidden
  // under the row until Use, so a pick re-renders only the row's foot.
  const choose = useCallback(
    (finish: Finish) => {
      if (finish === pick || launch !== 'picking') return;
      haptics.reskin();
      setPick(finish);
    },
    [haptics, launch, pick],
  );

  const finishTour = useCallback(
    (keepFinish: Finish) => {
      setLaunch('landing');
      store.completeTour(keepFinish);
      setPreview(null);
      track('tour_completed', { finish: keepFinish });
      // Home renders now, hidden under the row while the machine steps forward; then it fades in.
      setTour(null);
      setUiMode(null);
      const settle = reduceMotion ? 0 : DEVICE.TOUR_SETTLE;
      later(() => setLaunch('landed'), settle);
      later(() => {
        setLaunch(null);
        tourDone();
      }, settle + DEVICE.TOUR_FADE);
    },
    [later, reduceMotion, setPreview, setUiMode, store],
  );

  const keep = useCallback(() => {
    if (launch !== 'picking') return;
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
      restGo,
      loadStep,
      current,
      alternatives,
      target,
      run,
      // Not gated on `active`: the gift outlives the tour by its last steps (`landing`, `landed`).
      launch,
      pick,
      before,
      start,
      reveal,
      choose,
      keep,
    }),
    [active, alternatives, before, choose, current, dispatch, facts, keep, launch, line, loadStep, pick, restGo, restLeft, reveal, run, start, state, target],
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
