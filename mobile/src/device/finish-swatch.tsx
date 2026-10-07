import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  bodyFinish,
  finishColors,
  fontScaleCap,
  gadgetRadius,
  gadgetType,
  lcd,
  onboardingGeometry,
  onboardingType,
  sheetColors,
  sheetGeometry,
  space,
} from '@/constants/theme';
import { FINISHES, FREE_FINISHES, type Finish } from '@/domain/finish';
import { DEVICE, EASE_DISPLAY_FN } from '@/motion';

/** Finishes Trim Pro adds (D3, decision 80): every machine but Aluminium and Graphite. */
export const PRO_FINISHES: readonly Finish[] = FINISHES.filter((id) => !FREE_FINISHES.includes(id));

export function isProFinish(finish: Finish): boolean {
  return PRO_FINISHES.includes(finish);
}

/** The prototype's `.sw` transition: transform and shadow over .2s. */
const SELECT = { duration: DEVICE.KEY_DISABLE, easing: EASE_DISPLAY_FN } as const;

/**
 * A finish swatch (SPEC §6 Finishes, prototype `.sw`): the finish's own gradient, its number in
 * Doto 22 over its name (13). The selected one tilts −4°, lifts 4 and wears a white ring with a
 * drop shadow, easing there over 200 ms (a fade under Reduce Motion). A locked finish carries a
 * small `PRO` display chip (trim-ui §12 rule 20: locked, not hidden).
 */
export function FinishSwatch({
  id,
  selected,
  locked = false,
  width = sheetGeometry.swatchW,
  onPress,
  testID,
}: {
  id: Finish;
  selected: boolean;
  locked?: boolean;
  width?: number;
  onPress: () => void;
  testID?: string;
}) {
  const colors = finishColors[id];
  const reduceMotion = useReducedMotion();
  const on = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    const target = selected ? 1 : 0;
    on.set(withTiming(target, SELECT));
  }, [on, selected]);

  const liftStyle = useAnimatedStyle(() => {
    const t = on.get();
    if (reduceMotion) {
      // Reduce Motion: no tilt or lift; the ring alone fades in.
      return { transform: [] };
    }
    return {
      transform: [
        { translateY: interpolate(t, [0, 1], [0, -sheetGeometry.swatchLift]) },
        { rotate: `${interpolate(t, [0, 1], [0, sheetGeometry.swatchTilt])}deg` },
      ],
    };
  });
  const ringStyle = useAnimatedStyle(() => ({ opacity: on.get() }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`Finish ${id}, ${colors.name}${locked ? ', Trim Pro' : ''}`}
      testID={testID ?? `finish-${id}`}>
      {/* One bitmap with clear room around it, so the tilt draws smooth edges (swatchEdgePad). */}
      <Animated.View shouldRasterizeIOS style={[styles.frame, { width: width + PAD * 2 }, liftStyle]}>
        <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />
        <View
          style={[
            styles.swatch,
            {
              backgroundColor: colors.body2,
              experimental_backgroundImage: colors.bodyStops
                ? `linear-gradient(${HOLO_ANGLE}deg, ${colors.bodyStops.join(', ')})`
                : `linear-gradient(180deg, ${colors.body1}, ${colors.body2})`,
            },
          ]}>
          <Text
            maxFontSizeMultiplier={fontScaleCap.display}
            style={[gadgetType.swatchNumber, { color: colors.swatchInk }]}>
            {id}
          </Text>
          <Text
            numberOfLines={1}
            maxFontSizeMultiplier={fontScaleCap.display}
            style={[gadgetType.swatchName, styles.name, { color: colors.swatchSub }]}>
            {colors.name}
          </Text>
          {locked ? (
            <View style={styles.lock}>
              <Text maxFontSizeMultiplier={1} style={onboardingType.lock}>
                PRO
              </Text>
            </View>
          ) : null}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const RING = sheetGeometry.swatchRing;
const HOLO_ANGLE = bodyFinish.holoAngle;
const PAD = sheetGeometry.swatchEdgePad;

const styles = StyleSheet.create({
  frame: { height: sheetGeometry.swatchH + PAD * 2, margin: -PAD, padding: PAD },
  ring: {
    position: 'absolute',
    top: PAD - RING,
    left: PAD - RING,
    right: PAD - RING,
    bottom: PAD - RING,
    borderRadius: gadgetRadius.swatch + RING,
    borderCurve: 'continuous',
    borderWidth: RING,
    borderColor: sheetColors.ring,
    boxShadow: `0 12px 20px ${sheetColors.swatchShadow}`,
  },
  swatch: {
    flex: 1,
    borderRadius: gadgetRadius.swatch,
    borderCurve: 'continuous',
    paddingHorizontal: sheetGeometry.swatchPadX,
    paddingVertical: sheetGeometry.swatchPadY,
    overflow: 'hidden',
  },
  name: { marginTop: space.pair },
  lock: {
    position: 'absolute',
    right: onboardingGeometry.lockInset,
    top: onboardingGeometry.lockInset,
    height: onboardingGeometry.lockHeight,
    paddingHorizontal: onboardingGeometry.lockPadX,
    borderRadius: onboardingGeometry.lockRadius,
    borderCurve: 'continuous',
    backgroundColor: lcd.lcd,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
