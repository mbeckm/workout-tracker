import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { device, fontScaleCap, gadgetType } from '@/constants/theme';
import { useFinish, type DevicePalette } from '@/device/finish';
import { useHaptics } from '@/device/haptics';

import { usePressDepth } from './press';

/** primary: the machine's big key (orange on most). metal: Skip, Done, Plans. disabled: greyed, inert. */
export type BigKeyVariant = 'primary' | 'metal' | 'disabled';

type Look = {
  hi: string;
  lo: string;
  lip: string;
  ink: string;
  insets: string;
  glow: string;
};

function lookFor(variant: BigKeyVariant, palette: DevicePalette): Look {
  if (variant === 'metal') {
    return {
      hi: palette.metalHi,
      lo: palette.metalLo,
      lip: palette.keyEdge,
      ink: palette.keyInk,
      insets: `inset 0 2px 0 ${palette.keyHighlight}`,
      glow: palette.metalGlow,
    };
  }
  if (variant === 'disabled') {
    return {
      hi: palette.disabledHi,
      lo: palette.disabledLo,
      lip: palette.disabledLip,
      ink: palette.bigKeyInk,
      insets: `inset 0 2px 0 ${palette.bigKeyHighlight}`,
      glow: palette.metalGlow,
    };
  }
  return {
    hi: palette.bigKeyHi,
    lo: palette.bigKeyLo,
    lip: palette.bigKeyLip,
    ink: palette.bigKeyInk,
    insets: `inset 0 2px 0 ${palette.bigKeyHighlight}, inset 0 -6px 12px ${palette.bigKeyShade}`,
    glow: palette.bigKeyGlow,
  };
}

/**
 * The big round key (SPEC §4): 146pt, a radial gradient lit at 50% 22%, a 6pt lip and a soft
 * cast shadow. Press-in drops it 6pt in 80 ms, collapses the lip and plays the big-key haptic.
 * `onPressIn` / `onPressOut` let the finish hold drive the ring.
 */
export function BigKey({
  label,
  variant = 'primary',
  accessibilityLabel,
  onPress,
  onPressIn,
  onPressOut,
  style,
}: {
  label: string;
  variant?: BigKeyVariant;
  /** Defaults to the label. Finish: "Finish workout, hold". */
  accessibilityLabel?: string;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { palette } = useFinish();
  const haptics = useHaptics();
  const { pressIn, pressOut, faceStyle, lipStyle, pressedStyle } = usePressDepth(device.bigKeyPress);
  const look = lookFor(variant, palette);
  const disabled = variant === 'disabled';
  const size = device.bigKeySize;
  const shape = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View style={[shape, { opacity: disabled ? device.bigKeyDisabledOpacity : 1 }, style]}>
      {/* The lip and its 0 16 26 cast shadow (measured from the face; the lip sits 6 lower). */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.abs,
          shape,
          {
            top: device.bigKeyLip,
            backgroundColor: look.lip,
            boxShadow: `0 ${16 - device.bigKeyLip}px 26px ${look.glow}`,
          },
          lipStyle,
        ]}
      />
      {/* Pressed: only a small contact shadow remains (0 4 8). */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.abs,
          shape,
          {
            top: device.bigKeyPress,
            backgroundColor: look.lo,
            boxShadow: `0 4px 8px ${palette.bigKeyPressedDrop}`,
          },
          pressedStyle,
        ]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPressIn={() => {
          pressIn();
          haptics.bigKeyPress();
          onPressIn?.();
        }}
        onPressOut={() => {
          pressOut();
          onPressOut?.();
        }}
        onPress={onPress}
        style={[styles.abs, shape]}>
        <Animated.View
          style={[
            styles.abs,
            shape,
            styles.center,
            {
              backgroundColor: look.lo,
              experimental_backgroundImage: `radial-gradient(ellipse at 50% 22%, ${look.hi}, ${look.lo} 70%)`,
              boxShadow: look.insets,
            },
            faceStyle,
          ]}>
          <Text
            maxFontSizeMultiplier={fontScaleCap.display}
            numberOfLines={1}
            style={[gadgetType.bigKeyLabel, { color: look.ink }]}>
            {label}
          </Text>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute', left: 0, top: 0 },
  center: { alignItems: 'center', justifyContent: 'center' },
});
