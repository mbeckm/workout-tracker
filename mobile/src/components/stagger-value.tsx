import { NumberFlow } from 'number-flow-react-native';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { DURATION, EASE_OUT_FN } from '@/motion';

const SPIN = {
  duration: DURATION.change,
  easing: EASE_OUT_FN,
} as const;

/** Digit-roll hero — RN port of [NumberFlow](https://github.com/barvian/number-flow). */
export function StaggerValue({
  value,
  prefix,
  suffix,
  format,
  locales,
  style,
  animated = true,
}: {
  value: number | null;
  /** Static text before the number, in the same run so both share a baseline (`Set 2 of 4`). */
  prefix?: string;
  suffix?: string;
  format?: Intl.NumberFormatOptions;
  /** Defaults to the device region. */
  locales?: Intl.LocalesArgument;
  style?: StyleProp<TextStyle>;
  animated?: boolean;
  /** @deprecated NumberFlow respects Reduce Motion via `respectMotionPreference`. */
  reduceMotion?: boolean;
}) {
  const flat = StyleSheet.flatten(style);
  // Digits define height; a lineHeight here pads the slot and throws off sibling baseline.
  const { lineHeight: _lineHeight, ...textStyle } = flat ?? {};

  if (value == null || !Number.isFinite(value)) {
    return <Text style={flat}>—</Text>;
  }

  return (
    <NumberFlow
      value={value}
      prefix={prefix}
      suffix={suffix}
      format={format}
      locales={locales}
      style={textStyle}
      animated={animated}
      respectMotionPreference
      // Gradient edge fade reads as a reflection under the digits.
      mask={false}
      spinTiming={SPIN}
      transformTiming={SPIN}
      opacityTiming={{ duration: DURATION.enter, easing: EASE_OUT_FN }}
    />
  );
}
