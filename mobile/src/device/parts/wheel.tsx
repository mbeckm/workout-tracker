import { useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { device, gadgetRadius } from '@/constants/theme';
import { useFinish } from '@/device/finish';
import { useHaptics } from '@/device/haptics';
import { DEVICE, EASE_SHEET_GADGET_FN } from '@/motion';

import { EngravedLabel } from './engraved-label';

const W = device.wheelWidth;
const H = device.wheelHeight;
const PERIOD = device.wheelRidgeLight + device.wheelRidgeDark;
const NOTCH = device.wheelNotch;
/** Without a caller verdict, every 5th notch is a major one (SPEC §8). */
const MAJOR_EVERY = 5;

/**
 * What a notch did. `false`: rejected (at a limit), no haptic. `'major'`: a landmark (whole
 * 10 kg), the stronger haptic. Anything else: an ordinary notch.
 */
export type NotchResult = boolean | 'major' | void;

/**
 * The wheel (SPEC §4, §7): 64 × 180, r24, ridges of 5pt light and 2pt dark with inner shadows
 * at both ends. Dragging moves the ridges 1:1 with the finger on the UI thread; every 16pt of
 * travel is a notch, sent to `onNotch` on the JS thread (+1 up, −1 down) with its haptic.
 * VoiceOver treats it as an adjustable element. `stowed` slides it out (Home).
 */
export function Wheel({
  onNotch,
  accessibilityLabel,
  accessibilityValue,
  label,
  stowed = false,
  style,
}: {
  onNotch: (direction: 1 | -1) => NotchResult;
  /** "Weight", "Rest time", "Reps". */
  accessibilityLabel: string;
  /** Spoken value, e.g. "85 kilograms". */
  accessibilityValue?: string;
  /** Engraved label under the wheel: KG, TIME, REPS. */
  label?: string;
  stowed?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { palette } = useFinish();
  const haptics = useHaptics();
  const reduceMotion = useReducedMotion();

  // Counted on the UI thread so the handler below stays a plain function of its arguments.
  const notchCount = useSharedValue(0);

  const handleNotch = useCallback(
    (direction: 1 | -1, count: number) => {
      const result = onNotch(direction);
      if (result === false) return;
      if (result === 'major' || (result !== true && count % MAJOR_EVERY === 0)) {
        haptics.wheelNotchMajor();
      } else {
        haptics.wheelNotch();
      }
    },
    [haptics, onNotch],
  );

  // Ridge position (unbounded) and travel since the last notch.
  const position = useSharedValue(0);
  const travel = useSharedValue(0);
  const lastY = useSharedValue(0);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin(() => {
          lastY.set(0);
          travel.set(0);
        })
        .onUpdate((event) => {
          const dy = event.translationY - lastY.get();
          lastY.set(event.translationY);
          position.set(position.get() + dy);
          let acc = travel.get() + dy;
          while (acc <= -NOTCH) {
            acc += NOTCH;
            notchCount.set(notchCount.get() + 1);
            scheduleOnRN(handleNotch, 1, notchCount.get());
          }
          while (acc >= NOTCH) {
            acc -= NOTCH;
            notchCount.set(notchCount.get() + 1);
            scheduleOnRN(handleNotch, -1, notchCount.get());
          }
          travel.set(acc);
        }),
    [handleNotch, lastY, notchCount, position, travel],
  );

  const ridgeStyle = useAnimatedStyle(() => {
    const phase = ((position.get() % PERIOD) + PERIOD) % PERIOD;
    return { transform: [{ translateY: phase - PERIOD }] };
  });

  const stow = useSharedValue(stowed ? 1 : 0);
  useEffect(() => {
    stow.set(
      withTiming(stowed ? 1 : 0, { duration: DEVICE.WHEEL_STOW, easing: EASE_SHEET_GADGET_FN }),
    );
  }, [stow, stowed]);
  const stowStyle = useAnimatedStyle(() => {
    const t = stow.get();
    return reduceMotion
      ? { opacity: 1 - t }
      : {
          opacity: Math.max(0, 1 - t * (DEVICE.WHEEL_STOW / DEVICE.WHEEL_STOW_FADE)),
          transform: [
            { translateX: t * device.wheelStowX },
            { scale: 1 - t * (1 - device.wheelStowScale) },
          ],
        };
  });

  const shape = { width: W, height: H, borderRadius: gadgetRadius.wheel, borderCurve: 'continuous' as const };

  return (
    <Animated.View
      pointerEvents={stowed ? 'none' : 'auto'}
      accessibilityElementsHidden={stowed}
      importantForAccessibility={stowed ? 'no-hide-descendants' : 'auto'}
      style={[{ width: W }, stowStyle, style]}>
      <View style={{ width: W, height: H }}>
        <View
          pointerEvents="none"
          style={[
            styles.abs,
            shape,
            {
              top: device.wheelLip,
              backgroundColor: palette.keyEdge,
              boxShadow: `0 ${8 - device.wheelLip}px 14px ${palette.wheelDrop}`,
            },
          ]}
        />
        <GestureDetector gesture={pan}>
          <View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={accessibilityLabel}
            accessibilityValue={accessibilityValue ? { text: accessibilityValue } : undefined}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(event) => {
              // VoiceOver steps are deliberate; each is an ordinary notch.
              if (event.nativeEvent.actionName === 'increment') handleNotch(1, 1);
              if (event.nativeEvent.actionName === 'decrement') handleNotch(-1, 1);
            }}
            style={[styles.abs, shape, styles.clip, { backgroundColor: palette.wheelLight }]}>
            <Animated.View style={[styles.ridges, ridgeStyle]}>
              <Svg width={W} height={H + PERIOD * 2}>
                <Defs>
                  <Pattern id="ridge" width={W} height={PERIOD} patternUnits="userSpaceOnUse">
                    <Rect x={0} y={0} width={W} height={device.wheelRidgeLight} fill={palette.wheelLight} />
                    <Rect
                      x={0}
                      y={device.wheelRidgeLight}
                      width={W}
                      height={device.wheelRidgeDark}
                      fill={palette.wheelDark}
                    />
                  </Pattern>
                </Defs>
                <Rect width={W} height={H + PERIOD * 2} fill="url(#ridge)" />
              </Svg>
            </Animated.View>
            {/* The CSS inset 0 ±16 16 shadows; RN's inset boxShadow follows the radius as CSS does. */}
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  borderRadius: gadgetRadius.wheel,
                  borderCurve: 'continuous',
                  boxShadow: `inset 0 ${device.wheelShade}px ${device.wheelShade}px ${palette.wheelInset}, inset 0 -${device.wheelShade}px ${device.wheelShade}px ${palette.wheelInset}`,
                },
              ]}
            />
          </View>
        </GestureDetector>
      </View>
      {label ? <EngravedLabel style={styles.label}>{label}</EngravedLabel> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute', left: 0, top: 0 },
  clip: { overflow: 'hidden' },
  ridges: { position: 'absolute', left: 0, top: 0 },
  label: { marginTop: device.labelGap, width: W },
});
