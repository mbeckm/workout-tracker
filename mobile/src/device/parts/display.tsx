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

import { device, deviceColors, gadgetRadius, lcd } from '@/constants/theme';
import { DEVICE, EASE_DISPLAY } from '@/motion';

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
 * The display (SPEC §4): the lcd panel, r28, with a deep inset shadow and a light catch under
 * its lower edge. Content swaps when `contentKey` changes, fading and rising 8pt over 220 ms
 * (a plain fade with Reduce Motion). Children lay out absolutely inside, as on the prototype;
 * use `device.displayPad` for the inner padding.
 */
export function Display({
  contentKey,
  children,
  style,
  accessibilityLabel,
  accessibilityActions,
  onAccessibilityAction,
}: {
  /** Change it on every mode change (home → log → rest …) to play the swap. */
  contentKey: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** One summary per mode (PLAN §7 VoiceOver). */
  accessibilityLabel?: string;
  /** What the display's tappable words do (the exercise name, `TARGET ›`, the keypad). */
  accessibilityActions?: readonly AccessibilityActionInfo[];
  onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [height, setHeight] = useState(0);
  return (
    <View
      onLayout={(event: LayoutChangeEvent) => setHeight(event.nativeEvent.layout.height)}
      accessible={accessibilityLabel != null}
      accessibilityLabel={accessibilityLabel}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={onAccessibilityAction}
      style={[styles.panel, style]}>
      <View style={[StyleSheet.absoluteFill, styles.clip]}>
        <Animated.View
          key={contentKey}
          entering={!ANIMATES ? undefined : reduceMotion ? CONTENT_IN_REDUCED : CONTENT_IN}
          style={StyleSheet.absoluteFill}>
          <DisplayHeight value={height}>{children}</DisplayHeight>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Like CSS, the inset shadow paints under the content (a done row covers it).
  panel: {
    borderRadius: gadgetRadius.display,
    borderCurve: 'continuous',
    backgroundColor: lcd.lcd,
    boxShadow: `inset 0 3px 10px ${lcd.lcdShade}, 0 1px 0 ${deviceColors.recessRim}`,
  },
  clip: {
    borderRadius: gadgetRadius.display,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
});
