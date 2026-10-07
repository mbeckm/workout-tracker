/**
 * The guided tour (decision 85): Trim talks on its own display and walks a new owner through one
 * practice set, then launches into the Graphite reward. Pure TS, no `react-native`, so
 * `scripts/check-device-logic.ts` can assert it with `tsx`.
 *
 * The script is a list of beats, one line each. A beat waits for a tap on the display (`tap`) or
 * for the control it teaches; only that control and the ones already taught respond. Nothing is
 * logged or saved: the practice set lives here and is thrown away.
 */

/** What answers a beat: a tap on the display, or the control the line is about. */
export type TourWait = 'tap' | 'show' | 'wheel' | 'reps' | 'log' | 'undo' | 'next' | 'swap' | 'menu' | 'start';

/** The controls a beat can light. */
export type TourControl = Exclude<TourWait, 'tap' | 'show' | 'start'>;

/** What the display shows under the chat. */
export type TourScreen = 'intro' | 'log' | 'rest' | 'ready';

export type TourBeat = {
  /** The line, or a line built from the tour (the owner's name). */
  say: string | ((facts: TourFacts) => string);
  wait: TourWait;
  /** The display changes to this screen when the beat starts. */
  screen?: TourScreen;
  /** Shown without the line before it (a long line needs the room). */
  solo?: boolean;
};

export type TourFacts = { name: string };

/** The controls in the order the tour teaches them, by the beat that teaches each. */
export const TOUR_SCRIPT: readonly TourBeat[] = [
  { say: "Hi, I'm Trim.", wait: 'tap', screen: 'intro' },
  { say: 'Your workout machine.', wait: 'tap' },
  { say: 'Let me show you around.', wait: 'show' },
  { say: 'This is a practice set. Nothing gets saved.', wait: 'tap', screen: 'log' },
  { say: 'Turn the wheel to set the weight.', wait: 'wheel' },
  { say: "Nice. That's the weight.", wait: 'tap' },
  { say: '+ and − set the reps.', wait: 'reps' },
  { say: 'Got it.', wait: 'tap' },
  { say: 'Press Log when the set is done.', wait: 'log' },
  { say: 'This is your rest timer. You can skip it or change the duration.', wait: 'tap' },
  { say: 'Made a mistake? You can undo your previous set.', wait: 'undo' },
  { say: 'Undone. Nothing is lost.', wait: 'tap' },
  { say: 'Use the arrows to navigate between exercises.', wait: 'next' },
  { say: 'Orange is your current exercise. Finished ones are green.', wait: 'tap' },
  { say: 'Bench taken? Machine broken? Tap the name to swap.', wait: 'swap' },
  {
    say: 'Swapped for today. At the end of your workout, you can decide if you want to save it to your plan.',
    wait: 'tap',
    solo: true,
  },
  { say: 'Last one: the menu, top left.', wait: 'menu' },
  { say: (facts) => (facts.name ? `That's the tour, ${facts.name}.` : "That's the tour."), wait: 'tap', screen: 'ready' },
  { say: "Press Start. Something's waiting for you.", wait: 'start' },
];

/** The beat each control is taught on; before it the control doesn't respond. */
export const TEACH: Readonly<Record<TourControl, number>> = {
  wheel: beatOf('wheel'),
  reps: beatOf('reps'),
  log: beatOf('log'),
  undo: beatOf('undo'),
  next: beatOf('next'),
  swap: beatOf('swap'),
  menu: beatOf('menu'),
};

/** Where Skip (the top-right key, first screen only) lands: the end, so the reward still plays. */
export const READY_BEAT = TOUR_SCRIPT.findIndex((beat) => beat.screen === 'ready');

/** Wheel notches before the wheel beat counts as done (one notch can be an accident). */
export const WHEEL_NOTCHES = 2;

function beatOf(wait: TourWait): number {
  const index = TOUR_SCRIPT.findIndex((beat) => beat.wait === wait);
  if (index < 0) throw new Error(`No beat waits for ${wait}`);
  return index;
}

export function lineOf(beat: number, facts: TourFacts): string {
  const say = TOUR_SCRIPT[beat]?.say ?? '';
  return typeof say === 'function' ? say(facts) : say;
}

/** One practice lift: its name and what it can be swapped for. */
export type TourLift = { id: string; name: string; alternatives: readonly { id: string; name: string; meta: string }[] };

export type TourState = {
  beat: number;
  /** Characters of the current line on the display. */
  typed: number;
  /** The line before, dim above the current one (none on a `solo` beat or a new screen). */
  previous: string;
  screen: TourScreen;
  lifts: readonly TourLift[];
  lift: number;
  /** Sets logged on the current lift (0 or 1; Undo takes it back). */
  logged: number;
  setsPerLift: number;
  weight: number;
  reps: number;
  /** Wheel notches turned while the wheel beat waits. */
  notches: number;
  /** When the practice rest ends (ms since epoch), 0 when no rest runs. */
  restEndsAt: number;
  /** The longest this rest has been, in seconds (the ring measures against it, as the log's does). */
  restLongest: number;
};

export const TOUR_START_WEIGHT = 20;
export const TOUR_START_REPS = 8;
export const TOUR_REST_SECONDS = 90;
export const TOUR_SETS = 3;
const REPS_MIN = 1;
const REPS_MAX = 50;

export function initialTourState(lifts: readonly TourLift[]): TourState {
  return {
    beat: 0,
    typed: 0,
    previous: '',
    screen: 'intro',
    lifts,
    lift: 0,
    logged: 0,
    setsPerLift: TOUR_SETS,
    weight: TOUR_START_WEIGHT,
    reps: TOUR_START_REPS,
    notches: 0,
    restEndsAt: 0,
    restLongest: TOUR_REST_SECONDS,
  };
}

export type TourAction =
  /** The display types one more character. */
  | { type: 'type' }
  /** A tap on the display: finishes the line, or answers a `tap` beat. */
  | { type: 'tap' }
  | { type: 'show' }
  /** One wheel notch (`step` is the lift's load step). */
  | { type: 'wheel'; direction: 1 | -1; step: number }
  | { type: 'reps'; direction: 1 | -1 }
  | { type: 'log'; now: number }
  | { type: 'skipRest' }
  | { type: 'nudgeRest'; seconds: number; now: number }
  | { type: 'undo' }
  | { type: 'lift'; direction: 1 | -1 }
  | { type: 'swap'; alternativeId: string }
  | { type: 'menuClosed' }
  /** Skip, on the first screen: straight to the end. */
  | { type: 'skip' };

/** True once `control` has been taught (or is being taught now). */
export function taught(state: TourState, control: TourControl): boolean {
  return state.beat >= TEACH[control];
}

export function currentWait(state: TourState): TourWait | null {
  return TOUR_SCRIPT[state.beat]?.wait ?? null;
}

/** The control the current beat lights: only once its line is fully typed, so it reads first. */
export function litControl(state: TourState, facts: TourFacts): TourWait | null {
  const wait = currentWait(state);
  if (wait == null || wait === 'tap') return null;
  return state.typed >= lineOf(state.beat, facts).length ? wait : null;
}

/** The swap the tour asks for: the current lift's first alternative. */
export function swapTarget(state: TourState): TourLift['alternatives'][number] | null {
  return state.lifts[state.lift]?.alternatives[0] ?? null;
}

function advance(state: TourState, facts: TourFacts, patch: Partial<TourState> = {}): TourState {
  const next = state.beat + 1;
  const beat = TOUR_SCRIPT[next];
  if (!beat) return { ...state, ...patch };
  const newScreen = beat.screen != null && beat.screen !== state.screen && beat.screen !== 'log';
  return {
    ...state,
    ...patch,
    beat: next,
    typed: 0,
    previous: beat.solo || newScreen ? '' : lineOf(state.beat, facts),
    screen: beat.screen ?? patch.screen ?? state.screen,
  };
}

/** Advances when `wait` is what the current beat waits for; otherwise applies `patch` alone. */
function answer(state: TourState, facts: TourFacts, wait: TourWait, patch: Partial<TourState>): TourState {
  return currentWait(state) === wait ? advance(state, facts, patch) : { ...state, ...patch };
}

export function tourReducer(state: TourState, action: TourAction, facts: TourFacts): TourState {
  const line = lineOf(state.beat, facts);
  switch (action.type) {
    case 'type':
      return state.typed >= line.length ? state : { ...state, typed: state.typed + 1 };
    case 'tap':
      if (state.typed < line.length) return { ...state, typed: line.length };
      return currentWait(state) === 'tap' ? advance(state, facts) : state;
    case 'show':
      return currentWait(state) === 'show' ? advance(state, facts) : state;
    case 'wheel': {
      if (!taught(state, 'wheel')) return state;
      if (state.screen === 'rest') {
        return state.restEndsAt > 0 ? { ...state, restEndsAt: state.restEndsAt + action.direction * 15_000, restLongest: state.restLongest + Math.max(0, action.direction * 15) } : state;
      }
      if (state.screen !== 'log') return state;
      const weight = Math.max(0, roundTo(state.weight + action.direction * action.step, action.step));
      const notches = state.notches + 1;
      return notches >= WHEEL_NOTCHES
        ? answer(state, facts, 'wheel', { weight, notches })
        : { ...state, weight, notches };
    }
    case 'reps': {
      if (!taught(state, 'reps') || state.screen !== 'log') return state;
      const reps = Math.min(REPS_MAX, Math.max(REPS_MIN, state.reps + action.direction));
      return answer(state, facts, 'reps', { reps });
    }
    case 'log': {
      if (!taught(state, 'log') || state.screen !== 'log') return state;
      const logged = Math.min(state.setsPerLift, state.logged + 1);
      return answer(state, facts, 'log', {
        logged,
        screen: 'rest',
        restEndsAt: action.now + TOUR_REST_SECONDS * 1000,
        restLongest: TOUR_REST_SECONDS,
      });
    }
    case 'skipRest':
      return state.screen === 'rest' ? { ...state, screen: 'log', restEndsAt: 0 } : state;
    case 'nudgeRest':
      return state.screen === 'rest' && state.restEndsAt > 0
        ? {
            ...state,
            restEndsAt: Math.max(action.now, state.restEndsAt + action.seconds * 1000),
            restLongest: Math.max(state.restLongest, Math.ceil((state.restEndsAt + action.seconds * 1000 - action.now) / 1000)),
          }
        : state;
    case 'undo': {
      if (!taught(state, 'undo') || state.logged === 0) return state;
      return answer(state, facts, 'undo', { logged: state.logged - 1, screen: 'log', restEndsAt: 0 });
    }
    case 'lift': {
      if (!taught(state, 'next') || (state.screen !== 'log' && state.screen !== 'rest')) return state;
      const lift = Math.min(state.lifts.length - 1, Math.max(0, state.lift + action.direction));
      if (lift === state.lift) return state;
      const patch = { lift, logged: 0, screen: 'log' as const, restEndsAt: 0 };
      return action.direction > 0 ? answer(state, facts, 'next', patch) : { ...state, ...patch };
    }
    case 'swap': {
      if (!taught(state, 'swap')) return state;
      const current = state.lifts[state.lift];
      const target = current?.alternatives.find((item) => item.id === action.alternativeId);
      if (!current || !target) return state;
      // While the swap is being taught, only the asked-for alternative counts.
      if (currentWait(state) === 'swap' && target.id !== swapTarget(state)?.id) return state;
      const swapped: TourLift = { id: target.id, name: target.name, alternatives: current.alternatives.filter((item) => item.id !== target.id) };
      const lifts = state.lifts.map((item, index) => (index === state.lift ? swapped : item));
      return answer(state, facts, 'swap', { lifts });
    }
    case 'menuClosed':
      return currentWait(state) === 'menu' ? advance(state, facts) : state;
    case 'skip':
      return state.beat >= READY_BEAT
        ? state
        : { ...state, beat: READY_BEAT, typed: 0, previous: '', screen: 'ready', restEndsAt: 0 };
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

function roundTo(value: number, step: number): number {
  return step > 0 ? Math.round(value / step) * step : value;
}

/** The practice set's lamps under the lift name: done lit, the set on the display outlined. */
export function tourSetLamps(state: TourState): ('done' | 'on' | 'off')[] {
  return Array.from({ length: state.setsPerLift }, (_, index) =>
    index < state.logged ? 'done' : index === state.logged ? 'on' : 'off',
  );
}

/** The rocker's lamps: lifts before the current one done, the current one on (part once a set is in). */
export function tourLiftLamps(state: TourState): ('done' | 'on' | 'part' | 'off')[] {
  return state.lifts.map((_, index) =>
    index < state.lift ? 'done' : index === state.lift ? (state.logged > 0 ? 'part' : 'on') : 'off',
  );
}

/** Rest left in whole seconds. */
export function tourRestLeft(state: TourState, now: number): number {
  return state.restEndsAt > 0 ? Math.max(0, Math.ceil((state.restEndsAt - now) / 1000)) : 0;
}
