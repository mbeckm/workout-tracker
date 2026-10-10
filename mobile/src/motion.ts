import type { ViewStyle } from 'react-native';
import {
  cubicBezier,
  Easing,
  FadeIn,
  FadeInUp,
  FadeOut,
  type CSSStyle,
  type EntryOrExitLayoutType,
} from 'react-native-reanimated';

import { PRESSED_OPACITY } from '@/constants/theme';

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

/** EASE_OUT for Reanimated CSS transitions. */
const EASE_OUT_TRANSITION = cubicBezier(0.23, 1, 0.32, 1);

/**
 * A soft press for a big choice (onboarding's cards): it eases down to PRESS_SCALE over `press`
 * and back over `enter`, never a snap and never an overshoot. A Reanimated CSS transition, so React
 * holds both resting states (trim-ui §8 Rules). Reduce Motion: it dims instead of shrinking.
 */
export function softPress(pressed: boolean, reduceMotion: boolean): CSSStyle<ViewStyle> {
  if (reduceMotion) {
    return {
      opacity: pressed ? PRESSED_OPACITY : 1,
      transitionProperty: 'opacity',
      transitionDuration: pressed ? DURATION.press : DURATION.fade,
      transitionTimingFunction: EASE_OUT_TRANSITION,
    };
  }
  return {
    transform: [{ scale: pressed ? PRESS_SCALE : 1 }],
    transitionProperty: 'transform',
    transitionDuration: pressed ? DURATION.press : DURATION.enter,
    transitionTimingFunction: EASE_OUT_TRANSITION,
  };
}

/** A selection mark (a ring, a fill) fading in over `enter` and out over `exit`. Same under Reduce Motion: it's a fade. */
export function softSelect(selected: boolean): CSSStyle<ViewStyle> {
  return {
    opacity: selected ? 1 : 0,
    transitionProperty: 'opacity',
    transitionDuration: selected ? DURATION.enter : DURATION.exit,
    transitionTimingFunction: EASE_OUT_TRANSITION,
  };
}

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
export const EASE_DISPLAY_CURVE = [0.2, 0.8, 0.3, 1] as const;
export const EASE_DISPLAY = Easing.bezier(...EASE_DISPLAY_CURVE);
export const EASE_DISPLAY_FN = Easing.bezierFn(...EASE_DISPLAY_CURVE);
/** Gadget sheets and the wheel stow: bezier(.2,.9,.3,1). */
export const EASE_SHEET_GADGET = Easing.bezier(0.2, 0.9, 0.3, 1);
export const EASE_SHEET_GADGET_FN = Easing.bezierFn(0.2, 0.9, 0.3, 1);
/** Stamp landing: bezier(.2,1.6,.4,1) (overshoots on purpose). */
export const EASE_STAMP = Easing.bezier(0.2, 1.6, 0.4, 1);
export const EASE_STAMP_FN = Easing.bezierFn(0.2, 1.6, 0.4, 1);
/** Cartridge filing: bezier(.3,1.4,.5,1). */
export const EASE_FILE = Easing.bezier(0.3, 1.4, 0.5, 1);
export const EASE_FILE_FN = Easing.bezierFn(0.3, 1.4, 0.5, 1);
/** The paywall knob turned by hand: it gathers speed, then settles onto PRO. */
export const EASE_KNOB_FN = Easing.bezierFn(0.45, 0, 0.2, 1);
/** Plan insert pull-back: bezier(.6,0,.25,1). */
export const EASE_INSERT_PULL_FN = Easing.bezierFn(0.6, 0, 0.25, 1);
/** Plan insert slide-in: bezier(.55,0,.8,.35). */
export const EASE_INSERT_SLIDE_FN = Easing.bezierFn(0.55, 0, 0.8, 0.35);
/** The tour's gift (decision 95): the old skin lets go and falls, gathering speed, bezier(.55,0,1,.45). */
export const EASE_FALL_FN = Easing.bezierFn(0.55, 0, 1, 0.45);
/** CSS `ease-out` (the insert's click settle and slot glow). */
export const EASE_CSS_OUT_FN = Easing.bezierFn(0, 0, 0.58, 1);
/** Key press (CSS `transition: transform .08s` uses `ease`). */
export const EASE_KEY_FN = Easing.bezierFn(0.25, 0.1, 0.25, 1);
/** The week report dropping onto the spike (QC2 `drop`): bezier(.3,1.3,.5,1). */
export const EASE_WEEK_DROP_FN = Easing.bezierFn(0.3, 1.3, 0.5, 1);
export const LINEAR_FN = Easing.linear;
/** The rest battery's charging cell: a slow, even in and out. */
export const EASE_BREATHE_FN = Easing.bezierFn(0.45, 0, 0.55, 1);
/** First open (D74): the body floats in and just overshoots; parts accelerate into their hit; the Start key slams. */
export const EASE_ARRIVE_FN = Easing.bezierFn(0.2, 0.9, 0.25, 1.04);
export const EASE_HIT_FN = Easing.bezierFn(0.55, 0, 1, 0.6);
export const EASE_SLAM_FN = Easing.bezierFn(0.8, 0, 1, 0.5);

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
  /** The tour's practice rest reads its clock this often (`useRest` ticks every 250 ms too). */
  REST_TICK: 250,
  /** Rest's battery (decision 96): the charging cell brightens and fades once per REST_BREATHE. */
  REST_BREATHE: 2000,
  /** Full: one soft light sweep across the battery, as GO shows. */
  REST_SWEEP: 900,
  /** Finish mode's `N MIN` refresh. */
  MINUTE_TICK: 15000,
  /** Sheet in/out. */
  SHEET: 380,
  /** Scrim fade. */
  SCRIM: 300,
  /** Rocker tilt rotateY ±10° on an end press: held for ROCKER, easing in and out over ROCKER_TILT. */
  ROCKER: 160,
  ROCKER_TILT: 120,
  /**
   * The roll call (decision 86): today's lifts flash in over ROLL_IN on a rocker press, the frame
   * glides to the new row over ROLL_MOVE, the list holds ROLL_HOLD after the last press, then
   * fades out over ROLL_OUT. Any other key ends it at once.
   */
  ROLL_IN: 100,
  ROLL_MOVE: 180,
  ROLL_HOLD: 900,
  ROLL_OUT: 180,
  /**
   * The hand-off (decision 87): after a set that finishes a lift, the next lift's name comes in
   * over NEXT_IN, holds NEXT_HOLD, then shrinks up toward the header over NEXT_OUT.
   */
  NEXT_IN: 140,
  NEXT_HOLD: 1400,
  NEXT_OUT: 280,
  /** Lamp colour change (`transition: background .25s`). */
  LAMP: 250,
  /** Hold to finish: linear ring fill. */
  HOLD: 1100,
  /** The pause between the ring closing and finishing (prototype 120). */
  HOLD_COMMIT: 120,
  /** Receipt feed: 18 steps. */
  FEED: 1800,
  FEED_STEPS: 18,
  /**
   * The finish screen (decision 90, F3a): the stats rise in (RISE, each row STAGGER after the
   * last), their numbers count up over COUNT; on a moment the receipt then prints up (FEED, the
   * print haptic's 18 steps) after STUB_DELAY, and its stamp slams on STUB_STAMP_GAP after the
   * feed, the paper jolting under it.
   */
  FINISH_RISE: 420,
  FINISH_STAGGER: 80,
  FINISH_COUNT: 850,
  FINISH_COUNT_DELAY: 150,
  STUB_DELAY: 800,
  STUB_STAMP: 380,
  STUB_STAMP_GAP: 100,
  /** bezier(.3,1.4,.5,1) first reaches its end value at ~40% of STUB_STAMP: the thud plays there. */
  STUB_STAMP_LAND: 150,
  STUB_JOLT: 260,
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
  /** Plan insert (SPEC §7 table, stretched in the feel pass: more anticipation, a longer swing; seat at 2400, end 4100). */
  INSERT_SCENE: 600,
  INSERT_PULL: 1000,
  INSERT_CART_IN: 500,
  INSERT_SLIDE: 600,
  INSERT_CLICK: 300,
  INSERT_DIP: 520,
  INSERT_GLOW: 900,
  INSERT_PULSE: 1000,
  INSERT_BOOT: 600,
  INSERT_SWING: 900,
  INSERT_DAY_TICK: 240,
  /** Pauses in the insert (prototype `activate()`): before the slide, between the click and the swing. */
  INSERT_HOLD: 300,
  INSERT_SWING_DELAY: 800,
  /** The ticks start this long after face-on; Home comes this long after the last one. */
  INSERT_TICK_START: 120,
  INSERT_HOME_DELAY: 450,
  /** The lamps flick across at the click: the first after 60, then 55 apart, each lit 140. */
  INSERT_LAMP_FIRST: 60,
  INSERT_LAMP_STEP: 55,
  INSERT_LAMP_ON: 140,
  /** The grid floor slides one cell as the scene comes in. */
  INSERT_GRID: 1400,
  /** The scene's shadow grows in with it. */
  INSERT_SHADOW: 800,
  /** No `onSceneReady` from the native insert by then: the JS insert plays instead. */
  INSERT_NATIVE_TIMEOUT: 1500,
  /** Whoever awaits the insert (onboarding) stops waiting by then, whatever happened to the device. */
  INSERT_MAX_WAIT: 15000,
  /** The week moment (D15): the grid ground fades in, then the report drops onto the spike. */
  WEEK_SCENE: 600,
  WEEK_DROP: 700,
  WEEK_DROP_DELAY: 250,
  /** bezier(.3,1.3,.5,1) first reaches the spike at 45% of the drop: the thud plays there. */
  WEEK_DROP_LAND: 315,
  /** The moment fades away after Done. */
  WEEK_SCENE_OUT: 300,
  /** Blinking display text (INSERT PLAN, GO). */
  BLINK: 1000,
  /** A stepped change (CSS `steps(1)`): jumps, no tween. */
  SNAP: 0,
  /** Reduced-motion stand-in for every movement: a plain fade. */
  REDUCED_FADE: 160,
  /**
   * The paywall knob (N9): turns once from FREE to PRO once the modal has landed (its slide-up
   * takes ~500 ms), then the feature lamps light in turn.
   */
  KNOB_DELAY: 550,
  KNOB_TURN: 1000,
  KNOB_LAMP_STAGGER: 90,
  /** The exercise figure's demonstration loop (prototype `lift` / `sweep`, 2.4 s ease-in-out). */
  FIGURE_LOOP: 2400,
  /** The tour (decision 85): one character typed every TOUR_TYPE ms; a beat's next line waits TOUR_BEAT. */
  TOUR_TYPE: 28,
  TOUR_BEAT: 180,
  /**
   * The gift (decision 95): Start lets the old skin go. It falls away over TOUR_DROP (its thock
   * TOUR_RELEASE in) and Graphite stands behind it; from TOUR_STEP_BACK_DELAY the machine steps
   * back over TOUR_STEP_BACK into the row of six. Use steps it forward again over TOUR_SETTLE, then
   * the device fades in over it in TOUR_FADE (Reduce Motion: the fall and the steps are this fade).
   */
  TOUR_DROP: 520,
  TOUR_RELEASE: 60,
  TOUR_STEP_BACK_DELAY: 380,
  TOUR_STEP_BACK: 420,
  TOUR_SETTLE: 380,
  TOUR_FADE: 200,
  /**
   * Graphite unlocked (decision 97): as the row settles, eight pixel sparkles twinkle round the new
   * machine once, each for TOUR_SPARKLE_EACH, the last one done TOUR_SPARKLE after the first.
   */
  TOUR_SPARKLE: 1000,
  TOUR_SPARKLE_EACH: 420,
} as const;

/**
 * First open (D74): the machine is born. One clock from 0 to `END`; every part reads its place
 * from it. Shown once per install, so it takes its time (exempt from the 4 s moment budget,
 * feel pass): a slow approach out of space, the parts landing faster and faster, a long charge
 * with the camera pushing in, then the bang. Haptics and sounds play at the same times
 * (trim-ui §8 rule 3). About 6.5 s to Continue; a tap skips.
 */
export const ASSEMBLY = {
  /** The body approaches out of the dark, tumbling; its outline flashes as it lands. */
  ARRIVE: 1600,
  TRACE_AT: 1560,
  TRACE: 600,
  /** When each part lands; each flies for `FLY` before. */
  DISPLAY_AT: 2000,
  MENU_AT: 2420,
  HISTORY_AT: 2760,
  ROCKER_AT: 3040,
  PLUS_AT: 3260,
  MINUS_AT: 3440,
  WHEEL_AT: 3590,
  FLY: 200,
  /** Spark at each landing; the body's recoil. */
  SPARK: 360,
  KICK: 70,
  /** The well fades in, then the Start key hovers, trembles and slams while the camera pushes in. */
  WELL_AT: 3640,
  WELL: 220,
  CHARGE_AT: 3660,
  BANG: 4900,
  /** The share of the charge that's hover; the rest is the slam. */
  HOVER_SHARE: 0.8,
  SHAKE: 700,
  RING: 900,
  /** The second shockwave follows the first. */
  RING_2_DELAY: 140,
  BURST: 650,
  /** The grid floor lights at the bang. */
  GRID: 500,
  /** The display boots: a scan line, then SLOT EMPTY flickers on. */
  SCAN_AT: 5000,
  SCAN: 380,
  BOOT_AT: 5060,
  BOOT: 600,
  /** The words, then Continue. */
  WORDS_AT: 5600,
  ACTION_AT: 6300,
  /** The scene is over: everything goes static. */
  END: 6500,
} as const;

/** Rest at 0:00 shows GO for this long, then returns to the log view (PLAN D6). */
export const REST_GO_MS = 2000;

/**
 * Import plan (decision 88). The illustration is one loop: the first half copies a plan out of a
 * chat into Paste, the second half screenshots another app into Screenshots. Reading reveals each
 * found lift on a short stagger, so the work shows even when parsing was instant.
 */
export const IMPORT = {
  /** One full loop of the illustration (both scenes). */
  ART_LOOP: 8000,
  /** A scene fades in and out over this. */
  ART_FADE: 400,
  /** The selection sweeps over the reply. */
  ART_SELECT: 900,
  /** The Copy pill pops and holds. */
  ART_PILL: 600,
  /** The copied text, or the shot, flies to its button. */
  ART_FLY: 1000,
  /** The screenshot flash. */
  ART_FLASH: 280,
  /** The shot shrinks to a thumbnail and holds before it flies. */
  ART_SHRINK: 700,
  ART_HOLD: 500,
  /** Each found lift lands this long after the one before. */
  ROW_STAGGER: 140,
  /** A found lift drops in over this. */
  ROW_IN: 280,
  /** The placeholders breathe on this half-cycle before the first lift. */
  BREATHE: 700,
  /** New plan's Import card: each source's turn (lights, the arrow pushes, its lift lands). */
  SOURCE_STEP: 2000,
  /** New plan's Build card: each press of + adds a lift, typed a letter at a time. */
  LIFT_STEP: 1600,
  TYPE_CHAR: 55,
  /** The key's press: down, then back. */
  KEY_DOWN: 90,
  /** The progress bar eases to each new value over this. */
  BAR: 300,
} as const;
