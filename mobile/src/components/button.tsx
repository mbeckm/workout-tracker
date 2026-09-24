import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { radius, spacing } from '@/constants/theme';
import { PRESS_MS, PRESS_SCALE } from '@/motion';
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
  const reduceMotion = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const compact = size === 'compact';
  const pill = variant === 'filled' || variant === 'black' || variant === 'green' || variant === 'gray';
  // A disabled green pill at 40% reads as broken, not unavailable. Render it as a quiet
  // gray pill instead so the one green on a stage always means "ready".
  const quietDisabled = Boolean(disabled) && variant === 'green';
  const color = quietDisabled
    ? colors.tertiaryLabel
    : variant === 'black'
      ? colors.onLabel
      : variant === 'green'
        ? colors.onGreen
        : variant === 'filled'
          ? colors.onTint
          : variant === 'destructive'
            ? colors.systemRed
            : variant === 'gray'
              ? colors.label
              : colors.systemBlue;
  const backgroundColor = quietDisabled
    ? colors.secondarySystemBackground
    : variant === 'green'
      ? colors.systemGreen
      : variant === 'black'
        ? colors.label
        : variant === 'filled'
          ? colors.systemBlue
          : variant === 'gray'
            ? colors.secondarySystemBackground
            : 'transparent';
  const scalePress = Boolean(pressed && !disabled && !reduceMotion);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      pressRetentionOffset={16}
      hitSlop={compact ? 8 : undefined}
      testID={testID}
      style={style}>
      <Animated.View
        style={{
          width: '100%',
          minHeight: compact ? 32 : pill ? 52 : 44,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: compact ? 12 : spacing.lg,
          // Heights are minimums; vertical padding lets Dynamic Type grow the pill.
          paddingVertical: compact ? 6 : pill ? 12 : 8,
          borderRadius: pill ? radius.full : 0,
          borderCurve: 'continuous',
          backgroundColor,
          opacity: disabled && !quietDisabled ? 0.4 : reduceMotion && pressed ? 0.7 : 1,
          transform: [{ scale: scalePress ? PRESS_SCALE : 1 }],
          transitionProperty: 'transform',
          transitionDuration: `${PRESS_MS}ms`,
          transitionTimingFunction: 'ease-out',
        }}>
        <Text
          style={{
            ...type.headline,
            fontWeight: '700',
            fontSize: compact ? 15 : 17,
            textAlign: 'center',
            color,
          }}>
          {title}
        </Text>
      </Animated.View>
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
