import { useCallback } from 'react';
import {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { DEVICE, EASE_KEY_FN } from '@/motion';

/**
 * While a key is held, `pressed` drifts between 1 and this, far below a visible change (a
 * hundredth of a point of travel). A held worklet value that stops for a second is handed to
 * React as the key's resting look; if the release's sync is then lost to a JS stall (the
 * finish hold ends in the heaviest render of the app), the next commit shows the key pressed
 * again. Moving every frame, the hold is never handed over (trim-ui §8 Rules).
 */
const HELD_DRIFT = 0.998;
const HELD_DRIFT_MS = 400;

/**
 * Key travel (SPEC §7 Key press): on press-in the face drops `depth` and the lip under it
 * collapses, over 80 ms; release reverses it. Reduce Motion makes the change instant (the state
 * still reads, nothing slides).
 */
export function usePressDepth(depth: number) {
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);
  const duration = reduceMotion ? DEVICE.SNAP : DEVICE.KEY_PRESS;

  const pressIn = useCallback(() => {
    pressed.set(
      // The drift isn't motion anyone sees, so it runs under Reduce Motion too (the press itself
      // is already instant there: `duration` is SNAP).
      withSequence(
        ReduceMotion.Never,
        withTiming(1, { duration, easing: EASE_KEY_FN }),
        withRepeat(
          withTiming(HELD_DRIFT, { duration: HELD_DRIFT_MS, reduceMotion: ReduceMotion.Never }),
          -1,
          true,
          undefined,
          ReduceMotion.Never,
        ),
      ),
    );
  }, [duration, pressed]);

  const pressOut = useCallback(() => {
    pressed.set(withTiming(0, { duration, easing: EASE_KEY_FN }));
  }, [duration, pressed]);

  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pressed.get() * depth }],
  }));
  const lipStyle = useAnimatedStyle(() => ({ opacity: 1 - pressed.get() }));
  /** For layers that appear only while pressed (the big key's contact shadow). */
  const pressedStyle = useAnimatedStyle(() => ({ opacity: pressed.get() }));

  return { pressed: pressed as SharedValue<number>, pressIn, pressOut, faceStyle, lipStyle, pressedStyle };
}
