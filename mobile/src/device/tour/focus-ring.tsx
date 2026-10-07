import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { signal, tourColors, tourGeometry } from '@/constants/theme';
import { DEVICE } from '@/motion';

/**
 * The tour's focus ring (decision 85): the display's own 2-pt amber frame language, drawn around
 * the control Trim's current line names, 5 pt off it, with a soft glow. It appears once the line
 * is typed and goes the moment the control answers. `style` positions the wrapper (an absolutely
 * placed key keeps its slot); the child fills it.
 */
export function FocusRing({
  active,
  radius,
  style,
  children,
}: {
  active: boolean;
  /** The control's own corner radius. */
  radius: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  return (
    <View style={style}>
      {children}
      {active ? (
        <Animated.View
          entering={FadeIn.duration(DEVICE.DISPLAY)}
          exiting={FadeOut.duration(DEVICE.DISPLAY)}
          pointerEvents="none"
          style={[styles.ring, { borderRadius: radius + tourGeometry.focusOffset }]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    top: -tourGeometry.focusOffset,
    left: -tourGeometry.focusOffset,
    right: -tourGeometry.focusOffset,
    bottom: -tourGeometry.focusOffset,
    borderWidth: tourGeometry.focusStroke,
    borderColor: signal.orange,
    borderCurve: 'continuous',
    boxShadow: `0 0 ${tourGeometry.focusGlowRadius}px ${tourColors.focusGlow}`,
  },
});
