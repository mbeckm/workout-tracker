import {
  Easing,
  FadeIn,
  FadeInUp,
  FadeOut,
  type EntryOrExitLayoutType,
} from 'react-native-reanimated';

/** Strong ease-out for UI enter/exit and press. */
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
/**
 * NumberFlow wants a plain `(t) => number` that runs on the UI thread, so it must be a
 * worklet: Reanimated's `bezierFn`, not RN's `Easing.bezier` (that throws once it animates).
 */
export const EASE_OUT_FN = Easing.bezierFn(0.23, 1, 0.32, 1);
/** On-screen movement / morph. */
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
/** iOS sheet curve. */
export const EASE_SHEET = Easing.bezier(0.32, 0.72, 0, 1);

export const EASE_OUT_CSS = 'cubic-bezier(0.23, 1, 0.32, 1)';

/**
 * Durations (ms). Motion exists to make Trim feel faster, more fluid or more loveable
 * (trim-ui → Motion). A tap shows a reaction within 100ms (press feedback starts on
 * touch-down), and a tap transition finishes within `enter`. `change` is only for changes
 * you don't wait on; a celebration runs after the action has already landed.
 */
export const DURATION = {
  /** Press feedback. Starts on touch-down. */
  press: 120,
  /** Leaving: exits are always faster than enters. */
  exit: 150,
  /** Reduced-motion fades. */
  fade: 160,
  /** Arriving: a new set line, a toast, content swapped in place. */
  enter: 200,
  /** A change you don't wait on: number roll, theme crossfade. Never between a tap and what it opens. */
  change: 280,
  /** Ceiling for earned moments (week dot rings). Never on the path of a tap. */
  celebrate: 760,
} as const;

/**
 * Springs. No bounce unless a finger threw it (trim-ui → Motion): `settle` by default,
 * `fling` only after a gesture that carried momentum (pass its velocity), `pop` only for
 * rare rewards.
 */
export const SPRING = {
  /** Default: rows, repositioning, snap-back without velocity. Critically damped. */
  settle: { duration: 300, dampingRatio: 1 },
  /** After a flick, swipe release or thrown sheet. Hand it the gesture's velocity. */
  fling: { duration: 300, dampingRatio: 0.8 },
  /** A mark filling as a reward (week dot). The only real overshoot. */
  pop: { duration: 520, dampingRatio: 0.42 },
} as const;

/** Enter/exit distance. Things arrive from 8pt away, never from off-screen or from scale 0. */
export const ENTER_OFFSET = 8;

export const PRESS_MS = DURATION.press;
export const PRESS_SCALE = 0.97;

const ENTER_UP = FadeInUp.duration(DURATION.enter).easing(EASE_OUT).withInitialValues({
  opacity: 0,
  transform: [{ translateY: ENTER_OFFSET }],
});
const ENTER_UP_REDUCED = FadeIn.duration(DURATION.fade);
const EXIT = FadeOut.duration(DURATION.exit).easing(EASE_OUT);
const EXIT_REDUCED = FadeOut.duration(DURATION.press);

export function enterUp(reduceMotion: boolean, delayMs = 0): EntryOrExitLayoutType {
  const anim = reduceMotion ? ENTER_UP_REDUCED : ENTER_UP;
  return delayMs > 0 ? anim.delay(delayMs) : anim;
}

export function exitFade(reduceMotion: boolean): EntryOrExitLayoutType {
  return reduceMotion ? EXIT_REDUCED : EXIT;
}

/* ------------------------------------------------------------------------------------------ *
 * Gadget motion (design/gadget/SPEC.md §7). Durations in ms. The `*_FN` easings are worklets
 * (`Easing.bezierFn`) so they can run inside `withTiming` on the UI thread and in NumberFlow.
 * ------------------------------------------------------------------------------------------ */

/** Display content change and drum step: bezier(.2,.8,.3,1). */
export const EASE_DISPLAY = Easing.bezier(0.2, 0.8, 0.3, 1);
export const EASE_DISPLAY_FN = Easing.bezierFn(0.2, 0.8, 0.3, 1);
/** Gadget sheets and the wheel stow: bezier(.2,.9,.3,1). */
export const EASE_SHEET_GADGET = Easing.bezier(0.2, 0.9, 0.3, 1);
export const EASE_SHEET_GADGET_FN = Easing.bezierFn(0.2, 0.9, 0.3, 1);
/** Stamp landing: bezier(.2,1.6,.4,1) (overshoots on purpose). */
export const EASE_STAMP = Easing.bezier(0.2, 1.6, 0.4, 1);
export const EASE_STAMP_FN = Easing.bezierFn(0.2, 1.6, 0.4, 1);
/** Cartridge filing: bezier(.3,1.4,.5,1). */
export const EASE_FILE = Easing.bezier(0.3, 1.4, 0.5, 1);
export const EASE_FILE_FN = Easing.bezierFn(0.3, 1.4, 0.5, 1);
/** Plan insert pull-back: bezier(.6,0,.25,1). */
export const EASE_INSERT_PULL_FN = Easing.bezierFn(0.6, 0, 0.25, 1);
/** Plan insert slide-in: bezier(.55,0,.8,.35). */
export const EASE_INSERT_SLIDE_FN = Easing.bezierFn(0.55, 0, 0.8, 0.35);
/** Key press (CSS `transition: transform .08s` uses `ease`). */
export const EASE_KEY_FN = Easing.bezierFn(0.25, 0.1, 0.25, 1);
export const LINEAR_FN = Easing.linear;

export const DEVICE = {
  /** Key press-in and release: translateY 3 (round), 6 (big key); the lip collapses. */
  KEY_PRESS: 80,
  /** Key disabled fade (`opacity .2s`). */
  KEY_DISABLE: 200,
  /** Display content change: fade and rise 8. */
  DISPLAY: 220,
  /** Weight drum step: translateY ±24 back to 0. */
  DRUM: 160,
  /** The drum frame's flash (no weight yet): each off/on step lasts this long. */
  DRUM_FLASH: 120,
  /** Long-press repeat on the tall keys: a step every REPEAT once the long press lands. */
  REPEAT: 90,
  /** The rest ring glides between the clock's ticks (`useRest` ticks every 250 ms). */
  REST_TICK: 250,
  /** Finish mode's `N MIN` refresh. */
  MINUTE_TICK: 15000,
  /** Sheet in/out. */
  SHEET: 380,
  /** Scrim fade. */
  SCRIM: 300,
  /** Rocker tilt rotateY ±10° on an end press: held for ROCKER, easing in and out over ROCKER_TILT. */
  ROCKER: 160,
  ROCKER_TILT: 120,
  /** Lamp colour change (`transition: background .25s`). */
  LAMP: 250,
  /** Hold to finish: linear ring fill. */
  HOLD: 1100,
  /** The pause between the ring closing and finishing (prototype 120). */
  HOLD_COMMIT: 120,
  /** Receipt feed: 18 steps. */
  FEED: 1800,
  FEED_STEPS: 18,
  /** Stamp: scale 2.4 → 1, rotate −12° → 7°, after a delay; the row fills over STAMP. */
  STAMP: 500,
  STAMP_DELAY: 450,
  /**
   * When the stamp lands, into STAMP: bezier(.2,1.6,.4,1) first reaches its end value at
   * ~23% of the run, so the haptic and the sound play there (trim-ui §8 rule 3).
   */
  STAMP_LAND: 115,
  ROW_FILL_DELAY: 100,
  /** Lamp turns green: off, on, off, on in steps, after a delay. */
  LAMP_LIT: 900,
  LAMP_LIT_DELAY: 500,
  /** Wheel stow on Home: translateX 40, scale .9, opacity 0. */
  WHEEL_STOW: 350,
  WHEEL_STOW_FADE: 300,
  /** Cartridge filing, staggered. */
  FILE: 550,
  FILE_STAGGER: 120,
  SHELF_FLASH: 1200,
  /** Big key colour change between modes (`background .3s`). */
  BIG_KEY_SWAP: 300,
  /** Finish change on the body (`background-color .4s`). */
  FINISH: 400,
  /** Needle, goal ring, chart line. */
  NEEDLE: 1400,
  GOAL_RING: 1000,
  CHART: 1000,
  /** Plan insert (SPEC §7 table). */
  INSERT_SCENE: 600,
  INSERT_PULL: 750,
  INSERT_CART_IN: 420,
  INSERT_SLIDE: 430,
  INSERT_CLICK: 300,
  INSERT_DIP: 420,
  INSERT_GLOW: 600,
  INSERT_PULSE: 700,
  INSERT_BOOT: 450,
  INSERT_SWING: 700,
  INSERT_DAY_TICK: 190,
  /** Blinking display text (INSERT PLAN, GO). */
  BLINK: 1000,
  /** A stepped change (CSS `steps(1)`): jumps, no tween. */
  SNAP: 0,
  /** Reduced-motion stand-in for every movement: a plain fade. */
  REDUCED_FADE: 160,
  /** The exercise figure's demonstration loop (prototype `lift` / `sweep`, 2.4 s ease-in-out). */
  FIGURE_LOOP: 2400,
} as const;

/** Rest at 0:00 shows GO for this long, then returns to the log view (PLAN D6). */
export const REST_GO_MS = 2000;
