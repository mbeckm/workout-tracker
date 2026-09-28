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
 * (trim-ui → Motion). Anything a tap triggers finishes within `change`; only a celebration
 * may run longer, and it runs after the action has already landed.
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
  /** A value or layout changing in place: number roll, expand/collapse, theme crossfade. */
  change: 280,
  /** Ceiling for earned moments (week dot rings). Never on the path of a tap. */
  celebrate: 760,
} as const;

/** Springs for anything a finger drives or that settles into place. No bounce outside `pop`. */
export const SPRING = {
  /** Sheets, drags, swipes, rows settling. Pass the gesture's velocity. */
  settle: { duration: 300, dampingRatio: 0.85 },
  /** A mark filling as a reward (week dot). The only bouncy spring. */
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
