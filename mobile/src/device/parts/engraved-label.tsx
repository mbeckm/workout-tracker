import { Text, type StyleProp, type TextStyle } from 'react-native';

import { gadgetType } from '@/constants/theme';
import { useFinish } from '@/device/finish';

/**
 * An engraved body label (`.lab`): SF Rounded 800 10, letter spacing 1.5, uppercase, in the
 * finish's label colour with a 1pt shadow. Body engraving is hardware, so it never scales.
 */
export function EngravedLabel({
  children,
  accent,
  style,
}: {
  children: string;
  /** A trailing run in another colour (D20's `▲n` streak in orange). */
  accent?: { text: string; color: string };
  style?: StyleProp<TextStyle>;
}) {
  const { palette } = useFinish();
  return (
    <Text
      maxFontSizeMultiplier={1}
      numberOfLines={1}
      style={[
        gadgetType.engraved,
        {
          color: palette.label,
          textShadowColor: palette.labelShadow,
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 0,
          textAlign: 'center',
          textTransform: 'uppercase',
        },
        style,
      ]}>
      {children}
      {accent ? <Text style={{ color: accent.color }}>{accent.text}</Text> : null}
    </Text>
  );
}
