import { Easing as RNEasing } from 'react-native';
import {
  Easing,
  FadeIn,
  FadeInUp,
  FadeOut,
  type EntryOrExitLayoutType,
} from 'react-native-reanimated';

/** Strong ease-out for UI enter/exit and press. */
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
/** NumberFlow wants a `(t) => number`; RN Easing.bezier is that form. */
export const EASE_OUT_FN = RNEasing.bezier(0.23, 1, 0.32, 1);
/** On-screen movement / morph. */
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
/** iOS sheet curve. */
export const EASE_SHEET = Easing.bezier(0.32, 0.72, 0, 1);

export const EASE_OUT_CSS = 'cubic-bezier(0.23, 1, 0.32, 1)';

export const PRESS_MS = 120;
export const PRESS_SCALE = 0.97;

const ENTER_UP = FadeInUp.duration(200).easing(EASE_OUT).withInitialValues({
  opacity: 0,
  transform: [{ translateY: 8 }],
});
const ENTER_UP_REDUCED = FadeIn.duration(160);
const EXIT = FadeOut.duration(150).easing(EASE_OUT);
const EXIT_REDUCED = FadeOut.duration(120);

export function enterUp(reduceMotion: boolean, delayMs = 0): EntryOrExitLayoutType {
  const anim = reduceMotion ? ENTER_UP_REDUCED : ENTER_UP;
  return delayMs > 0 ? anim.delay(delayMs) : anim;
}

export function exitFade(reduceMotion: boolean): EntryOrExitLayoutType {
  return reduceMotion ? EXIT_REDUCED : EXIT;
}
