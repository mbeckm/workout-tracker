import { useCallback } from 'react';
import {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { DEVICE, EASE_KEY_FN } from '@/motion';

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
    pressed.set(withTiming(1, { duration, easing: EASE_KEY_FN }));
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
