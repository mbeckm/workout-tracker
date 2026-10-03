import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { device, lcd, signal } from '@/constants/theme';
import { useFinish } from '@/device/finish';
import { DEVICE } from '@/motion';

/**
 * off: not started. on: current (amber, glowing). done: finished (green). part: some sets
 * logged (rocker only). `lit` plays the turn-green flicker once on mount (SPEC §7).
 */
export type LampState = 'off' | 'on' | 'done' | 'part';

/** `rocker`: 10pt lamps in the rocker's strip. `plate`: 12pt lamps on the recessed plate. */
export type LampSurface = 'rocker' | 'plate';

/** The flicker's keyframes as fractions of LAMP_LIT: green at 20%, off at 35%, green from 50%. */
const LIT_ON_1 = 0.2;
const LIT_OFF = 0.35;
const LIT_ON_2 = 0.5;

export function Lamp({
  state,
  surface = 'rocker',
  lit = false,
  compact = false,
}: {
  state: LampState;
  surface?: LampSurface;
  lit?: boolean;
  /** Rocker lamps shrink to 8pt when a day has more than 12 lifts (PLAN §7). */
  compact?: boolean;
}) {
  const { palette } = useFinish();
  const reduceMotion = useReducedMotion();
  const size =
    surface === 'plate' ? device.plateLamp : compact ? device.lampCompact : device.lamp;

  // 0 = off colour, 1 = green. Only drives the `lit` flicker.
  const flicker = useSharedValue(lit && !reduceMotion ? 0 : 1);
  useEffect(() => {
    if (!lit || reduceMotion) {
      flicker.set(1);
      return;
    }
    const at = (fraction: number) => fraction * DEVICE.LAMP_LIT;
    const snap = (value: number) => withTiming(value, { duration: DEVICE.SNAP });
    flicker.set(0);
    flicker.set(
      withSequence(
        withDelay(DEVICE.LAMP_LIT_DELAY + at(LIT_ON_1), snap(1)),
        withDelay(at(LIT_OFF - LIT_ON_1), snap(0)),
        withDelay(at(LIT_ON_2 - LIT_OFF), snap(1)),
      ),
    );
  }, [flicker, lit, reduceMotion]);
  const greenStyle = useAnimatedStyle(() => ({ opacity: flicker.get() }));

  const offFill = surface === 'plate' ? palette.plateLampOff : palette.lampOff;
  const shape = { width: size, height: size, borderRadius: size / 2 };

  if (state === 'done') {
    return (
      <View style={[shape, { backgroundColor: offFill }]}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            shape,
            {
              backgroundColor: signal.done,
              boxShadow: `inset 0 1px 1px ${palette.lampDoneShine}, 0 0 4px ${signal.doneGlow}`,
            },
            greenStyle,
          ]}
        />
      </View>
    );
  }

  const fill =
    state === 'on' ? lcd.amber : state === 'part' && surface === 'rocker' ? palette.lampPart : offFill;
  const shadow =
    state === 'on'
      ? `0 0 ${surface === 'plate' ? 8 : 6}px ${lcd.amber}`
      : surface === 'plate'
        ? `inset 0 1px 2px ${palette.plateLampShade}`
        : undefined;

  return (
    <Animated.View
      style={[
        shape,
        {
          backgroundColor: fill,
          boxShadow: shadow,
          transitionProperty: 'backgroundColor',
          transitionDuration: DEVICE.LAMP,
        },
      ]}
    />
  );
}
