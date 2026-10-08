import { StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion, withTiming } from 'react-native-reanimated';

import { device, gadgetType, lcd, logGeometry } from '@/constants/theme';
import { DEVICE, EASE_OUT_FN } from '@/motion';

import { LcdText, useScreenStyles } from './lcd-text';

/** Comes in with a slight grow over NEXT_IN. */
function cardIn() {
  'worklet';
  const timing = { duration: DEVICE.NEXT_IN, easing: EASE_OUT_FN };
  return {
    initialValues: { opacity: 0, transform: [{ scale: logGeometry.nextInScale }] },
    animations: { opacity: withTiming(1, timing), transform: [{ scale: withTiming(1, timing) }] },
  };
}

/** Leaves by rising and shrinking toward the header, where the name lives on the log view. */
function cardOut() {
  'worklet';
  const timing = { duration: DEVICE.NEXT_OUT, easing: EASE_OUT_FN };
  return {
    initialValues: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
    animations: {
      opacity: withTiming(0, timing),
      transform: [
        { translateY: withTiming(-logGeometry.nextOutRise, timing) },
        { scale: withTiming(logGeometry.nextOutScale, timing) },
      ],
    },
  };
}

/**
 * The hand-off (decision 87): after a set that finishes a lift, the display clears to `NEXT`,
 * the next lift's name in `lcdTitle` and its prescription, centred, for NEXT_HOLD; then rest
 * shows. Not interactive: touches pass through, and any key ends it.
 */
export function NextCard({ name, meta }: { name: string; meta: string }) {
  const styles = useScreenStyles(baseStyles);
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View
      entering={reduceMotion ? FadeIn.duration(DEVICE.REDUCED_FADE) : cardIn}
      exiting={reduceMotion ? FadeOut.duration(DEVICE.REDUCED_FADE) : cardOut}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.card]}>
      <LcdText style={[gadgetType.lcdSmall, styles.dim]}>NEXT</LcdText>
      <LcdText
        lines={logGeometry.nextNameLines}
        adjustsFontSizeToFit
        minimumFontScale={logGeometry.nextNameMinScale}
        style={[gadgetType.lcdTitle, styles.name]}>
        {name}
      </LcdText>
      <LcdText style={[gadgetType.lcdSmall, styles.dim]}>{meta}</LcdText>
    </Animated.View>
  );
}

const baseStyles = StyleSheet.create({
  card: {
    backgroundColor: lcd.lcd,
    alignItems: 'center',
    justifyContent: 'center',
    gap: logGeometry.nextGap,
    paddingHorizontal: device.displayPad,
  },
  dim: { color: lcd.amberDim },
  name: { textAlign: 'center', alignSelf: 'stretch' },
});
