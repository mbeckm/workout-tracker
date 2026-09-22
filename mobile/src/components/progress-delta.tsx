import { NumberFlow } from 'number-flow-react-native';

import { EASE_OUT_FN } from '@/motion';

const SPIN = {
  duration: 280,
  easing: EASE_OUT_FN,
} as const;

/**
 * ▲/▼ + rolling % as one NumberFlow run so the mark and digits share a baseline.
 */
export function ProgressDelta({
  percent,
  color,
}: {
  percent: number;
  color: string;
}) {
  const negative = percent < 0;
  return (
    <NumberFlow
      value={Math.abs(Math.round(percent))}
      prefix={negative ? '▼ ' : '▲ '}
      suffix="%"
      style={{
        fontSize: 22,
        fontWeight: '700',
        letterSpacing: -0.02 * 22,
        color,
      }}
      respectMotionPreference
      mask={false}
      spinTiming={SPIN}
      transformTiming={SPIN}
      opacityTiming={{ duration: 180, easing: EASE_OUT_FN }}
      // Match hero cap line (NumberFlow slot boxes sit low vs display text).
      containerStyle={{ transform: [{ translateY: -2 }] }}
    />
  );
}
