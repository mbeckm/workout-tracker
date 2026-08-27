import { Stack } from 'expo-router';
import { Pressable, Text, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing } from '@/constants/theme';
import { useTheme } from '@/theme/theme-context';

export type ButtonVariant = 'filled' | 'black' | 'green' | 'gray' | 'plain' | 'destructive';

/**
 * In-content buttons. Header actions must use `HeaderActions` so iOS 26
 * liquid glass is applied once by the system, not around a custom capsule.
 */
export function Button({
  title,
  onPress,
  disabled,
  variant = 'filled',
  size = 'regular',
  style,
  testID,
}: {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: 'regular' | 'compact';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { colors, type } = useTheme();
  const compact = size === 'compact';
  const pill = variant === 'filled' || variant === 'black' || variant === 'green' || variant === 'gray';
  const color =
    variant === 'black'
      ? colors.onLabel
      : pill && variant !== 'gray'
        ? colors.onTint
        : variant === 'destructive'
          ? colors.systemRed
          : variant === 'gray'
            ? colors.label
            : colors.systemBlue;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        {
          minHeight: compact ? 32 : pill ? 52 : 44,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: compact ? 12 : spacing.lg,
          paddingVertical: compact ? 6 : 0,
          borderRadius: pill ? radius.full : 0,
          borderCurve: 'continuous',
          backgroundColor:
            variant === 'green'
              ? colors.systemGreen
              : variant === 'black'
                ? colors.label
                : variant === 'filled'
                  ? colors.systemBlue
                  : variant === 'gray'
                    ? colors.secondarySystemBackground
                    : 'transparent',
          opacity: disabled ? 0.4 : pressed ? 0.55 : 1,
        },
        style,
      ]}>
      <Text style={{ ...type.headline, fontWeight: '700', fontSize: compact ? 15 : 17, color }}>
        {title}
      </Text>
    </Pressable>
  );
}

export type HeaderAction = {
  title: string;
  onPress: () => void;
  variant?: 'plain' | 'done' | 'prominent';
  disabled?: boolean;
};

/**
 * Native stack toolbar items. Render as a screen child (not inside `headerRight`).
 * `prominent` / `done` is the system filled glass control — do not wrap a blue pill in the header.
 */
export function HeaderActions({ left, right }: { left?: HeaderAction; right?: HeaderAction }) {
  return (
    <>
      {left ? (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button
            variant={left.variant ?? 'plain'}
            disabled={left.disabled}
            onPress={left.onPress}>
            {left.title}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : null}
      {right ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            variant={right.variant ?? 'prominent'}
            disabled={right.disabled}
            onPress={right.onPress}>
            {right.title}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : null}
    </>
  );
}
