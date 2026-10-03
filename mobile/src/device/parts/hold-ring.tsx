import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { device, lcd } from '@/constants/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = device.wellSize;
const CENTER = SIZE / 2;
const R = device.holdRingRadius;
const CIRCUMFERENCE = 2 * Math.PI * R;
/** RN SVG has no drop-shadow filter: a wider, translucent stroke under the ring stands in for the glow. */
const GLOW_STROKE = device.holdRingStroke * 2;

/**
 * The hold-to-finish ring (SPEC §4): an amber 6pt stroke at r80 around the well, filling
 * clockwise from 12 o'clock as `progress` goes 0 → 1, with a soft glow. Hidden at 0.
 * The caller drives `progress` (linear over DEVICE.HOLD, snaps back on release).
 */
export function HoldRing({
  progress,
  style,
}: {
  progress: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
}) {
  const ringProps = useAnimatedProps(() => {
    const p = Math.min(1, Math.max(0, progress.get()));
    return { strokeDashoffset: CIRCUMFERENCE * (1 - p), strokeOpacity: p > 0 ? 1 : 0 };
  });

  return (
    <View pointerEvents="none" style={[{ width: SIZE, height: SIZE }, style]}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <AnimatedCircle
          cx={CENTER}
          cy={CENTER}
          r={R}
          fill="none"
          stroke={lcd.amberGlow}
          strokeWidth={GLOW_STROKE}
          strokeLinecap="round"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
          animatedProps={ringProps}
        />
        <AnimatedCircle
          cx={CENTER}
          cy={CENTER}
          r={R}
          fill="none"
          stroke={lcd.amber}
          strokeWidth={device.holdRingStroke}
          strokeLinecap="round"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
          animatedProps={ringProps}
        />
      </Svg>
    </View>
  );
}
