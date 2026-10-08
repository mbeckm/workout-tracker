import { createContext, useContext, useState, type ReactNode } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeIn, FadeInUp, useReducedMotion } from 'react-native-reanimated';

import { device, gadgetRadius } from '@/constants/theme';
import { useFinish } from '@/device/finish';
import { DEVICE, EASE_DISPLAY } from '@/motion';

import { BezelMarks } from './finish-marks';
import { ScreenSurface } from './screen-surface';

const CONTENT_IN = FadeInUp.duration(DEVICE.DISPLAY)
  .easing(EASE_DISPLAY)
  .withInitialValues({ opacity: 0, transform: [{ translateY: device.displayRise }] });
const CONTENT_IN_REDUCED = FadeIn.duration(DEVICE.DISPLAY);
/** Reanimated's web entering can leave a freshly mounted screen hidden; web only smoke-tests. */
const ANIMATES = Platform.OS !== 'web';

const DisplayHeight = createContext(0);

/**
 * The display's measured height (0 before the first layout). Content lays out from it: on
 * iPhone SE the display is ~296 tall instead of 420 (SPEC §4). The display outlives its content
 * swaps, so a new mode reads the height on its first frame.
 */
export function useDisplayHeight(): number {
  return useContext(DisplayHeight);
}

/**
 * The display (SPEC §4): the machine's screen (decision 80), r28, with a deep inset shadow, its
 * texture and glass on top, and a light catch under its lower edge. Pocket and Bunker sit it in
 * a bezel, which takes the same slot; the content lays out from the screen inside. Content swaps
 * when `contentKey` changes, fading and rising 8pt over 220 ms (a plain fade with Reduce Motion).
 * Children lay out absolutely inside, as on the prototype; use `device.displayPad` for the inner
 * padding.
 */
export function Display({
  contentKey,
  children,
  overlay,
  style,
  accessibilityLabel,
  accessibilityActions,
  onAccessibilityAction,
}: {
  /** Change it on every mode change (home → log → rest …) to play the swap. */
  contentKey: string;
  children: ReactNode;
  /** Drawn over the content and outliving its swaps (the roll call, decision 86). */
  overlay?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** One summary per mode (PLAN §7 VoiceOver). */
  accessibilityLabel?: string;
  /** What the display's tappable words do (the exercise name, `TARGET ›`, the keypad). */
  accessibilityActions?: readonly AccessibilityActionInfo[];
  onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
}) {
  const reduceMotion = useReducedMotion();
  const { finish, palette, screen } = useFinish();
  const [height, setHeight] = useState(0);
  const bezel = palette.bezel;
  const radius = bezel ? bezel.displayRadius : gadgetRadius.display;
  const panel = (
    <View
      onLayout={(event: LayoutChangeEvent) => setHeight(event.nativeEvent.layout.height)}
      accessible={accessibilityLabel != null}
      accessibilityLabel={accessibilityLabel}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={onAccessibilityAction}
      style={[
        styles.panel,
        {
          borderRadius: radius,
          backgroundColor: screen.lcd,
          boxShadow: `inset 0 3px 10px ${screen.lcdShade}, 0 1px 0 ${palette.recessRim}`,
        },
        bezel ? styles.fill : style,
      ]}>
      <View style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: radius }]}>
        <Animated.View
          key={contentKey}
          entering={!ANIMATES ? undefined : reduceMotion ? CONTENT_IN_REDUCED : CONTENT_IN}
          style={StyleSheet.absoluteFill}>
          <DisplayHeight value={height}>{children}</DisplayHeight>
        </Animated.View>
        {overlay ? <DisplayHeight value={height}>{overlay}</DisplayHeight> : null}
        <ScreenSurface screen={screen} id={`screen-${finish}`} />
      </View>
    </View>
  );
  if (!bezel) return panel;
  return (
    <View
      style={[
        style,
        {
          borderRadius: bezel.radius,
          borderBottomRightRadius: bezel.radiusBottomRight ?? bezel.radius,
          paddingHorizontal: bezel.padH,
          paddingTop: bezel.padTop,
          paddingBottom: bezel.padBottom,
          backgroundColor: bezel.bottom,
          experimental_backgroundImage: `linear-gradient(180deg, ${bezel.top}, ${bezel.bottom})`,
          boxShadow: `inset 0 2px 0 ${palette.bodyRimOutline}, inset 0 -2px 0 ${palette.bezelShade}, 0 1px 0 ${palette.recessRim}`,
        },
      ]}>
      {panel}
      <BezelMarks />
    </View>
  );
}

const styles = StyleSheet.create({
  // Like CSS, the inset shadow paints under the content (a done row covers it).
  panel: { borderCurve: 'continuous' },
  fill: { flex: 1 },
  clip: { borderCurve: 'continuous', overflow: 'hidden' },
});
