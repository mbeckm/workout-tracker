import { NumberFlow } from 'number-flow-react-native';

import { DURATION, EASE_OUT_FN } from '@/motion';
import { useTheme } from '@/theme/theme-context';

const SPIN = {
  duration: DURATION.change,
  easing: EASE_OUT_FN,
} as const;

/**
 * ↑/↓ + rolling % as one NumberFlow run so the arrow and digits share a baseline. Always ink:
 * change is a fact, not a signal (trim-ui §5 Change is ink, §11 rule 2), so up isn't green and
 * down isn't red. No change reads `0%` without an arrow: an arrow on zero claims a direction
 * that isn't there.
 */
export function ProgressDelta({ percent }: { percent: number }) {
  const { type } = useTheme();
  const rounded = Math.round(percent);
  // NumberFlow's digit slots define the height; a lineHeight would pad them off the hero's baseline.
  const { lineHeight: _lineHeight, ...titleStyle } = type.title;
  return (
    <NumberFlow
      value={Math.abs(rounded)}
      prefix={rounded < 0 ? '↓ ' : rounded > 0 ? '↑ ' : ''}
      suffix="%"
      style={titleStyle}
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
