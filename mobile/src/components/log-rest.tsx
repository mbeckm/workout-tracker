import * as Haptics from 'expo-haptics';
import { NumberFlow } from 'number-flow-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View, type TextStyle } from 'react-native';
import Animated, { FadeIn, FadeInUp, FadeOut, useReducedMotion } from 'react-native-reanimated';

import type { RestWindow } from '@/domain/log-session';
import { useTheme } from '@/theme/theme-context';
import { PRESSED_OPACITY, space } from '@/constants/theme';
import { DURATION, EASE_OUT, EASE_OUT_FN, ENTER_OFFSET } from '@/motion';

/** How long `Go` stays up after the clock hits 0:00. */
export const REST_GO_MS = 2000;
export const REST_NUDGE_SECONDS = 15;

// Rest over, every-set tier (trim-ui §8): the clock gives way to `Go` within `press`, on
// the same frame as the success haptic. `Go` rises into the clock's slot, as the next set
// is where you're headed; the frame keeps its height because both share the 28pt role.
const GO_IN = FadeInUp.duration(DURATION.press).easing(EASE_OUT).withInitialValues({
  opacity: 0,
  transform: [{ translateY: ENTER_OFFSET }],
});
const GO_IN_REDUCED = FadeIn.duration(DURATION.press);
const CLOCK_OUT = FadeOut.duration(DURATION.press).easing(EASE_OUT);

function formatRestClock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** The clock's cap on Dynamic Type, so it never outgrows the exercise name. */
const CLOCK_MAX_SCALE = 1.2;
const ROLL = { duration: DURATION.change, easing: EASE_OUT_FN } as const;
/** Seconds' tens digit wraps at 5 (0:50 + 15 = 1:05 spins 5 → 0, not back through 4…1). */
const SECONDS_DIGITS = { 1: { max: 5 } } as const;

/**
 * `m:ss` as two NumberFlow runs. It only rolls while `rolling` (a −15 / +15 nudge, in the
 * nudge's direction); the per-second countdown swaps plainly, because time passing is
 * information, not motion (trim-ui §8 rule 9).
 */
function RestClock({
  seconds,
  rolling,
  style,
}: {
  seconds: number;
  rolling: -1 | 1 | null;
  style: TextStyle;
}) {
  const { fontScale } = useWindowDimensions();
  const { lineHeight: _lineHeight, ...flat } = StyleSheet.flatten(style);
  // NumberFlow has no maxFontSizeMultiplier; its glyphs scale with fontScale, so shrink the
  // base size to land on the same cap the plain Text had.
  const fontSize =
    flat.fontSize == null ? undefined : (flat.fontSize * Math.min(fontScale, CLOCK_MAX_SCALE)) / fontScale;
  const shared = {
    style: fontSize == null ? flat : { ...flat, fontSize },
    animated: rolling != null,
    trend: rolling ?? 0,
    respectMotionPreference: true,
    mask: false,
    spinTiming: ROLL,
    transformTiming: ROLL,
    opacityTiming: { duration: DURATION.enter, easing: EASE_OUT_FN },
  } as const;
  return (
    <View style={{ flexDirection: 'row' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <NumberFlow {...shared} value={Math.floor(seconds / 60)} suffix=":" format={{ useGrouping: false }} />
      <NumberFlow
        {...shared}
        value={seconds % 60}
        format={{ minimumIntegerDigits: 2, useGrouping: false }}
        digits={SECONDS_DIGITS}
      />
    </View>
  );
}

/**
 * `Rest` + clock above the wells, with quiet −15 / +15 / Skip on the baseline.
 * At 0:00 the clock becomes a green `Go` (the same green as `Log set` below it) with one
 * success haptic, the controls fade, and after two seconds `onExpire` removes it.
 * Owns its tick so the rest of the log doesn't re-render.
 */
export function LogRest({
  rest,
  onSkip,
  onAdjust,
  onExpire,
  onGo,
}: {
  rest: RestWindow;
  onSkip: () => void;
  /** Seconds to add (negative shortens). */
  onAdjust: (seconds: number) => void;
  onExpire: () => void;
  /** The clock hit 0:00 (the `Go` moment). */
  onGo?: () => void;
}) {
  const { colors, type } = useTheme();
  const reduceMotion = useReducedMotion();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const cuedFor = useRef<number | null>(null);
  const onExpireRef = useRef(onExpire);
  const onGoRef = useRef(onGo);

  useEffect(() => {
    onExpireRef.current = onExpire;
    onGoRef.current = onGo;
  }, [onExpire, onGo]);

  useEffect(() => {
    const tick = setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      if (now >= rest.endsAtMs && cuedFor.current !== rest.endsAtMs) {
        cuedFor.current = rest.endsAtMs;
        if (process.env.EXPO_OS === 'ios') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        onGoRef.current?.();
      }
      if (now >= rest.endsAtMs + REST_GO_MS) {
        onExpireRef.current();
      }
    }, 250);
    return () => clearInterval(tick);
  }, [rest.endsAtMs]);

  // A nudge rolls the clock for one `change`, with a selection tick on the tap (trim-ui → Haptics).
  const [rolling, setRolling] = useState<-1 | 1 | null>(null);
  useEffect(() => {
    if (rolling == null) {
      return;
    }
    const timer = setTimeout(() => setRolling(null), DURATION.change);
    return () => clearTimeout(timer);
  }, [rolling, rest.endsAtMs]);
  const nudge = (seconds: number) => {
    if (process.env.EXPO_OS === 'ios') {
      void Haptics.selectionAsync();
    }
    setRolling(seconds > 0 ? 1 : -1);
    onAdjust(seconds);
  };

  const done = nowMs >= rest.endsAtMs;
  const seconds = Math.max(0, Math.ceil((rest.endsAtMs - nowMs) / 1000));
  const control = type.caption;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
      <Pressable
        onPress={onSkip}
        accessibilityRole="button"
        accessibilityLabel={done ? 'Rest over, go' : `Rest, ${formatRestClock(seconds)} left`}
        accessibilityHint="Skips the rest">
        <Text style={type.kicker}>Rest</Text>
        {done ? (
          <Animated.Text
            key="go"
            entering={reduceMotion ? GO_IN_REDUCED : GO_IN}
            maxFontSizeMultiplier={CLOCK_MAX_SCALE}
            style={[type.residue, { color: colors.systemGreen }]}>
            Go
          </Animated.Text>
        ) : (
          <Animated.View key="clock" exiting={CLOCK_OUT}>
            <RestClock
              seconds={seconds}
              rolling={rolling}
              style={{ ...type.residue, fontVariant: ['tabular-nums'] }}
            />
          </Animated.View>
        )}
      </Pressable>
      <Animated.View
        pointerEvents={done ? 'none' : 'auto'}
        style={{
          flexDirection: 'row',
          marginBottom: -5,
          opacity: done ? 0 : 1,
          transitionProperty: 'opacity',
          transitionDuration: `${DURATION.press}ms`,
          transitionTimingFunction: 'ease-out',
        }}>
        {[
          { label: `−${REST_NUDGE_SECONDS}`, a11y: `Shorten rest by ${REST_NUDGE_SECONDS} seconds`, onPress: () => nudge(-REST_NUDGE_SECONDS) },
          { label: `+${REST_NUDGE_SECONDS}`, a11y: `Add ${REST_NUDGE_SECONDS} seconds of rest`, onPress: () => nudge(REST_NUDGE_SECONDS) },
          { label: 'Skip', a11y: 'Skip rest', onPress: onSkip },
        ].map((item) => (
          <Pressable
            key={item.label}
            onPress={item.onPress}
            accessibilityRole="button"
            accessibilityLabel={item.a11y}
            testID={`log-rest-${item.label === 'Skip' ? 'skip' : item.label.startsWith('+') ? 'plus' : 'minus'}`}
            style={({ pressed }) => ({
              minWidth: 44,
              minHeight: 44,
              paddingHorizontal: space.related,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? PRESSED_OPACITY : 1,
            })}>
            <Text style={[control, { fontVariant: ['tabular-nums'] }]}>{item.label}</Text>
          </Pressable>
        ))}
      </Animated.View>
    </View>
  );
}
