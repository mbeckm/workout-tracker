import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { device, gadgetRadius, gadgetType, lcd } from '@/constants/theme';
import { DEVICE, EASE_DISPLAY_FN } from '@/motion';

/** One wheel step, so the drum knows which way to roll. `id` must change on every step. */
export type DrumNudge = { direction: 1 | -1; id: number };

/**
 * The weight drum (SPEC §5 Log): the step above (40, dim), the current value (104) and the step
 * below (40, dim), framed by a 2pt amber rounded rectangle 124 tall, with the display's top fade
 * over the upper step. On each wheel notch the column jumps 24pt in the notch's direction and
 * settles back over 160 ms. Fills the display (absolute); values come formatted.
 */
export function Drum({
  current,
  above,
  below,
  nudge,
  compact = false,
  framed = true,
  flash = 0,
}: {
  current: string;
  above?: string;
  below?: string;
  nudge?: DrumNudge | null;
  /** Weights from 1000 up shrink to 88 so they fit (PLAN §7). */
  compact?: boolean;
  /** Flash or hide the frame (the first-set focus cue in Phase 4). */
  framed?: boolean;
  /** Bump it to flash the frame (the first weighted set has no weight: look here). */
  flash?: number;
}) {
  const reduceMotion = useReducedMotion();
  const offset = useSharedValue(0);

  useEffect(() => {
    if (!nudge || reduceMotion) return;
    offset.set(nudge.direction * device.drumStepTravel);
    offset.set(withTiming(0, { duration: DEVICE.DRUM, easing: EASE_DISPLAY_FN }));
  }, [nudge, offset, reduceMotion]);

  const rollStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));

  // Off, on, off, on in steps (a blink, not movement, so Reduce Motion keeps it).
  const frameOpacity = useSharedValue(1);
  useEffect(() => {
    if (!flash) return;
    const snap = (value: number) => withDelay(DEVICE.DRUM_FLASH, withTiming(value, { duration: DEVICE.SNAP }));
    frameOpacity.set(0);
    frameOpacity.set(withSequence(snap(1), snap(0), snap(1)));
  }, [flash, frameOpacity]);
  const frameStyle = useAnimatedStyle(() => ({ opacity: frameOpacity.get() }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, rollStyle]}>
        {above != null ? (
          <Text maxFontSizeMultiplier={1} style={[gadgetType.lcdStep, styles.dim, styles.above]}>
            {above}
          </Text>
        ) : null}
        <Text
          maxFontSizeMultiplier={1}
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[compact ? gadgetType.lcdHeroCompact : gadgetType.lcdHero, styles.current]}>
          {current}
        </Text>
        {below != null ? (
          <Text maxFontSizeMultiplier={1} style={[gadgetType.lcdStep, styles.dim, styles.below]}>
            {below}
          </Text>
        ) : null}
      </Animated.View>
      <View
        style={[
          styles.fade,
          { experimental_backgroundImage: `linear-gradient(180deg, ${lcd.lcd}, ${lcd.lcdClear})` },
        ]}
      />
      {framed ? <Animated.View style={[styles.frame, frameStyle]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { color: lcd.amberDim },
  above: { position: 'absolute', left: device.displayPad, top: device.drumAboveY },
  current: { position: 'absolute', left: device.displayPad, right: device.displayPad, top: device.drumCurrentY },
  below: { position: 'absolute', left: device.displayPad, top: device.drumBelowY },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: device.drumFadeY,
    height: device.drumFadeHeight,
  },
  frame: {
    position: 'absolute',
    left: device.drumFrameInset,
    right: device.drumFrameInset,
    top: device.drumFrameY,
    height: device.drumFrameHeight,
    borderRadius: gadgetRadius.lcdFrame,
    borderCurve: 'continuous',
    borderWidth: device.drumFrameStroke,
    borderColor: lcd.amber,
  },
});
