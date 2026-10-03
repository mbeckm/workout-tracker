import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { device, fontScaleCap, gadgetRadius, gadgetType } from '@/constants/theme';
import { useFinish } from '@/device/finish';
import { useHaptics } from '@/device/haptics';
import { DEVICE } from '@/motion';

import { MinusGlyph, PlusGlyph, UndoGlyph } from './glyphs';
import { usePressDepth } from './press';

/**
 * Glyph labels drawn in SVG, because the text glyphs in SF Rounded are lighter and smaller
 * than the prototype's (+ and − 16pt at 3pt; ↶ a bold arc).
 */
const DRAWN: Record<string, () => ReactNode> = {
  '+': () => <PlusGlyph />,
  '−': () => <MinusGlyph />,
  '↶': () => <UndoGlyph />,
};

/** Which `gadgetType` key role the text label uses. */
export type KeyText = 'glyph' | 'glyphLarge' | 'word' | 'wordSmall';

const TEXT_ROLE = {
  glyph: gadgetType.keyGlyph,
  glyphLarge: gadgetType.keyGlyphLarge,
  word: gadgetType.keyWord,
  wordSmall: gadgetType.keyWordSmall,
} as const;

export type RaisedKeyProps = {
  accessibilityLabel: string;
  onPress?: () => void;
  /** Long-press repeat and similar; the press-in visuals and haptic still run. */
  onLongPress?: () => void;
  disabled?: boolean;
  /** A text label (glyph or word). `+`, `−` and `↶` are drawn in SVG. Use `children` for other SVG glyphs. */
  label?: string;
  text?: KeyText;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * A raised metal key (`.rk`): the key gradient, a 1pt inset highlight, a 3pt lip in the
 * finish's keyEdge and a soft cast shadow. Press-in drops the face 3pt and collapses the lip
 * (80 ms) and plays the key haptic. Disabled: 45% opacity.
 */
function RaisedKey({
  width,
  height,
  radius,
  accessibilityLabel,
  onPress,
  onLongPress,
  disabled = false,
  label,
  text = 'glyph',
  children,
  style,
}: RaisedKeyProps & { width: number; height: number; radius: number }) {
  const { palette } = useFinish();
  const haptics = useHaptics();
  const { pressIn, pressOut, faceStyle, lipStyle } = usePressDepth(device.keyPress);
  const shape = { width, height, borderRadius: radius, borderCurve: 'continuous' as const };

  return (
    <Animated.View
      style={[
        { width, height, opacity: disabled ? device.keyDisabledOpacity : 1 },
        styles.disableTransition,
        style,
      ]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.abs,
          shape,
          {
            top: device.keyLip,
            backgroundColor: palette.keyEdge,
            // The prototype's 0 6 10 cast shadow, measured from the face; the lip sits 3 lower.
            boxShadow: `0 ${6 - device.keyLip}px 10px ${palette.keyDrop}`,
          },
          lipStyle,
        ]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPressIn={() => {
          pressIn();
          haptics.key();
        }}
        onPressOut={pressOut}
        onPress={onPress}
        onLongPress={onLongPress}
        style={[styles.abs, shape]}>
        <Animated.View
          style={[
            styles.abs,
            shape,
            styles.center,
            {
              backgroundColor: palette.key2,
              experimental_backgroundImage: `linear-gradient(180deg, ${palette.key1}, ${palette.key2})`,
              boxShadow: `inset 0 1px 0 ${palette.keyHighlight}`,
            },
            faceStyle,
          ]}>
          {label != null && DRAWN[label] ? (
            DRAWN[label]()
          ) : label != null ? (
            <Text maxFontSizeMultiplier={fontScaleCap.display} style={TEXT_ROLE[text]}>
              {label}
            </Text>
          ) : (
            children
          )}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/** The 56pt round key (menu, history, undo, remove). */
export function RoundKey(props: RaisedKeyProps) {
  return <RaisedKey {...props} width={device.keySize} height={device.keySize} radius={gadgetRadius.key} />;
}

/** The 64 × 76 left key (+/− reps, ±15 rest, +/− sets, Back). */
export function TallKey(props: RaisedKeyProps) {
  return (
    <RaisedKey
      text="glyphLarge"
      {...props}
      width={device.tallKeyWidth}
      height={device.tallKeyHeight}
      radius={gadgetRadius.tallKey}
    />
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute', left: 0, top: 0 },
  center: { alignItems: 'center', justifyContent: 'center' },
  disableTransition: {
    transitionProperty: 'opacity',
    transitionDuration: DEVICE.KEY_DISABLE,
  },
});
