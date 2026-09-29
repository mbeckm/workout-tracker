import { NumberFlow } from 'number-flow-react-native';
import { Text } from 'react-native';

import { PROGRESS_HERO_LOCALE } from '@/domain/progress';
import { DURATION, EASE_OUT_FN } from '@/motion';
import { useTheme } from '@/theme/theme-context';

const SPIN = {
  duration: DURATION.change,
  easing: EASE_OUT_FN,
} as const;

/**
 * The change over the range, beside a detail hero: ↑ `7 kg` / ↓ `2 kg` as one NumberFlow run
 * (the arrow and digits share a baseline) in `title`, or `same`. Always ink: change is a fact,
 * not a signal (trim-ui §5 Change is ink, §11 rule 2), so up isn't green and down isn't red.
 * `decimals`: 0 for a lift's estimated 1RM, 1 for body values.
 */
export function ProgressDelta({ change, unit, decimals = 0 }: { change: number; unit: string; decimals?: 0 | 1 }) {
  const { colors, type } = useTheme();
  const factor = decimals === 1 ? 10 : 1;
  const rounded = Math.round(change * factor) / factor;
  if (rounded === 0) {
    return <Text style={[type.caption, { color: colors.tertiaryLabel }]}>same</Text>;
  }
  // NumberFlow's digit slots define the height; a lineHeight would pad them off the hero's baseline.
  const { lineHeight: _lineHeight, ...titleStyle } = type.title;
  return (
    <NumberFlow
      value={Math.abs(rounded)}
      prefix={rounded < 0 ? '↓ ' : '↑ '}
      suffix={` ${unit}`}
      format={{ maximumFractionDigits: decimals, useGrouping: false }}
      locales={PROGRESS_HERO_LOCALE}
      style={titleStyle}
      respectMotionPreference
      mask={false}
      spinTiming={SPIN}
      transformTiming={SPIN}
      opacityTiming={{ duration: DURATION.enter, easing: EASE_OUT_FN }}
    />
  );
}
