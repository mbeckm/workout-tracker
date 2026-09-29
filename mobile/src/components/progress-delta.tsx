import { NumberFlow } from 'number-flow-react-native';

import { DURATION, EASE_OUT_FN } from '@/motion';
import { useTheme } from '@/theme/theme-context';

const SPIN = {
  duration: DURATION.change,
  easing: EASE_OUT_FN,
} as const;

/**
 * ▲/▼ + rolling % as one NumberFlow run so the mark and digits share a baseline.
 * Green if up, ink if flat or down, never red (trim-ui → Charts 2). No change reads `0%`
 * without an arrow: an arrow on zero claims a direction that isn't there.
 * `neutral` keeps it ink either way, for values where up isn't better (body measurements).
 */
export function ProgressDelta({ percent, neutral = false }: { percent: number; neutral?: boolean }) {
  const { colors, type } = useTheme();
  const rounded = Math.round(percent);
  // NumberFlow's digit slots define the height; a lineHeight would pad them off the hero's baseline.
  const { lineHeight: _lineHeight, ...titleStyle } = type.title;
  return (
    <NumberFlow
      value={Math.abs(rounded)}
      prefix={rounded < 0 ? '▼ ' : rounded > 0 ? '▲ ' : ''}
      suffix="%"
      style={{ ...titleStyle, color: rounded > 0 && !neutral ? colors.systemGreen : colors.label }}
      respectMotionPreference
      mask={false}
      spinTiming={SPIN}
      transformTiming={SPIN}
      opacityTiming={{ duration: DURATION.enter, easing: EASE_OUT_FN }}
      // Match hero cap line (NumberFlow slot boxes sit low vs display text).
      containerStyle={{ transform: [{ translateY: -2 }] }}
    />
  );
}
