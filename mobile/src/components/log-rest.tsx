import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, FadeOut, useReducedMotion } from 'react-native-reanimated';

import type { RestWindow } from '@/domain/log-session';
import { useTheme } from '@/theme/theme-context';
import { PRESSED_OPACITY, space } from '@/constants/theme';
import { DURATION, EASE_OUT, ENTER_OFFSET } from '@/motion';

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
            maxFontSizeMultiplier={1.2}
            style={[type.residue, { color: colors.systemGreen }]}>
            Go
          </Animated.Text>
        ) : (
          <Animated.Text
            key="clock"
            exiting={CLOCK_OUT}
            maxFontSizeMultiplier={1.2}
            style={[type.residue, { fontVariant: ['tabular-nums'] }]}>
            {formatRestClock(seconds)}
          </Animated.Text>
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
          { label: `−${REST_NUDGE_SECONDS}`, a11y: `Shorten rest by ${REST_NUDGE_SECONDS} seconds`, onPress: () => onAdjust(-REST_NUDGE_SECONDS) },
          { label: `+${REST_NUDGE_SECONDS}`, a11y: `Add ${REST_NUDGE_SECONDS} seconds of rest`, onPress: () => onAdjust(REST_NUDGE_SECONDS) },
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
