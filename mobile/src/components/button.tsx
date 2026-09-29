import { Stack } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { PRESSED_OPACITY, radius, spacing } from '@/constants/theme';
import { DURATION, PRESS_MS, PRESS_SCALE } from '@/motion';
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
  maxFontSizeMultiplier,
  unlit,
}: {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: 'regular' | 'compact';
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Caps Dynamic Type on the label, for buttons in fixed chrome (a footer that doesn't scroll). */
  maxFontSizeMultiplier?: number;
  /**
   * Green only: the pill waits in the gray fill (label ink, a hair smaller) and lights up
   * green when this turns false (the log's start moment, trim-ui §8). It stays tappable.
   */
  unlit?: boolean;
}) {
  const { colors, type } = useTheme();
  const reduceMotion = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const compact = size === 'compact';
  const pill = variant === 'filled' || variant === 'black' || variant === 'green' || variant === 'gray';
  // A disabled green pill at 40% reads as broken, not unavailable. Render it as a quiet
  // gray pill instead so the one green on a stage always means "ready".
  const quietDisabled = Boolean(disabled) && variant === 'green';
  // Only a button that opts in crossfades its fill; everywhere else a variant change is instant.
  const lightable = unlit != null && variant === 'green';
  const waiting = lightable && Boolean(unlit) && !disabled;
  const color = quietDisabled
    ? colors.tertiaryLabel
    : waiting
      ? colors.label
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
  const backgroundColor = quietDisabled || waiting
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
  const scale = scalePress || (waiting && !reduceMotion) ? PRESS_SCALE : 1;

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
          opacity: disabled && !quietDisabled ? 0.4 : reduceMotion && pressed ? PRESSED_OPACITY : 1,
          transform: [{ scale }],
          transitionProperty: lightable ? ['transform', 'backgroundColor'] : 'transform',
          transitionDuration: lightable ? [`${PRESS_MS}ms`, `${DURATION.enter}ms`] : `${PRESS_MS}ms`,
          transitionTimingFunction: 'ease-out',
        }}>
        <Animated.Text
          maxFontSizeMultiplier={maxFontSizeMultiplier}
          style={{
            ...type.headline,
            fontWeight: '700',
            fontSize: compact ? 15 : 17,
            textAlign: 'center',
            color,
            ...(lightable
              ? {
                  transitionProperty: 'color',
                  transitionDuration: `${DURATION.enter}ms`,
                  transitionTimingFunction: 'ease-out',
                }
              : null),
          }}>
          {title}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

export type HeaderAction = {
  /** The label, or with `icon` the VoiceOver label only. */
  title: string;
  /** SF Symbol shown instead of the label (`plus` for Create plan). */
  icon?: Extract<ComponentProps<typeof Stack.Toolbar.Button>['icon'], string>;
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
            icon={left.icon}
            accessibilityLabel={left.icon ? left.title : undefined}
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
            icon={right.icon}
            accessibilityLabel={right.icon ? right.title : undefined}
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
