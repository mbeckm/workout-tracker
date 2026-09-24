import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { RestWindow } from '@/domain/log-session';
import { useTheme } from '@/theme/theme-context';

/** How long `Go` stays up after the clock hits 0:00. */
export const REST_GO_MS = 2000;
export const REST_NUDGE_SECONDS = 15;

function formatRestClock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * `Rest` + clock above the wells, with quiet −15 / +15 / Skip on the baseline.
 * At 0:00 it fires one success haptic and reads `Go` for two seconds, then
 * `onExpire` removes it. Owns its tick so the rest of the log doesn't re-render.
 */
export function LogRest({
  rest,
  onSkip,
  onAdjust,
  onExpire,
}: {
  rest: RestWindow;
  onSkip: () => void;
  /** Seconds to add (negative shortens). */
  onAdjust: (seconds: number) => void;
  onExpire: () => void;
}) {
  const { colors, type } = useTheme();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const cuedFor = useRef<number | null>(null);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    const tick = setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      if (now >= rest.endsAtMs && cuedFor.current !== rest.endsAtMs) {
        cuedFor.current = rest.endsAtMs;
        if (process.env.EXPO_OS === 'ios') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
      if (now >= rest.endsAtMs + REST_GO_MS) {
        onExpireRef.current();
      }
    }, 250);
    return () => clearInterval(tick);
  }, [rest.endsAtMs]);

  const done = nowMs >= rest.endsAtMs;
  const seconds = Math.max(0, Math.ceil((rest.endsAtMs - nowMs) / 1000));
  const control = { fontSize: 15, lineHeight: 20, color: colors.tertiaryLabel } as const;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
      <Pressable
        onPress={onSkip}
        accessibilityRole="button"
        accessibilityLabel={done ? 'Rest over' : `Rest, ${formatRestClock(seconds)} left`}
        accessibilityHint="Skips the rest">
        <Text style={[type.kicker, done ? { color: colors.label } : null]}>
          {done ? 'Go' : 'Rest'}
        </Text>
        <Text
          maxFontSizeMultiplier={1.2}
          style={[type.residue, { fontVariant: ['tabular-nums'] }]}>
          {formatRestClock(seconds)}
        </Text>
      </Pressable>
      <View
        pointerEvents={done ? 'none' : 'auto'}
        style={{ flexDirection: 'row', marginBottom: -5, opacity: done ? 0 : 1 }}>
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
              paddingHorizontal: 6,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.5 : 1,
            })}>
            <Text style={[control, { fontVariant: ['tabular-nums'] }]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
