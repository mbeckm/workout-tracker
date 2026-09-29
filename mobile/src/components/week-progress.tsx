import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { StaggerValue } from '@/components/stagger-value';
import { radius, space } from '@/constants/theme';
import { DURATION, EASE_OUT, SPRING } from '@/motion';
import { useTheme } from '@/theme/theme-context';

/** A dot to fill with the pop; `weekDone` adds the bump across every dot. */
export type WeekCelebration = { index: number; weekDone: boolean; key: number };

/**
 * The week as an amount (trim-ui → Home week details): `n of m` + `this week` + dots, one dot
 * per trainable day, green once done. Home shows it read-only in its week row; Done plays the
 * celebration on it when the workout just moved the week (trim-ui → Motion → Week dot fills).
 */
export function WeekProgress({
  done,
  total,
  celebrate = null,
}: {
  done: number;
  total: number;
  celebrate?: WeekCelebration | null;
}) {
  const { type } = useTheme();
  return (
    <View style={{ gap: space.related, alignItems: 'flex-start' }}>
      {/* NumberFlow has no text baseline to align to; bottom edges match within a point. */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.tight }}>
        {/* One NumberFlow with a suffix: a sibling Text would sit on a different baseline. */}
        <StaggerValue value={done} suffix={` of ${total}`} style={type.title} />
        <Text style={type.caption}>this week</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.related }}>
        {Array.from({ length: total }, (_, index) => (
          <WeekDot
            key={index}
            filled={index < done}
            celebrateKey={celebrate?.index === index ? celebrate.key : null}
            waveKey={celebrate?.weekDone ? celebrate.key : null}
            waveDelay={index * WAVE_STAGGER_MS}
          />
        ))}
      </View>
    </View>
  );
}

const DOT = 10;
/** The rings leave 140ms apart (trim-ui → Motion → Week dot fills). */
const RING_STAGGER_MS = 140;
/** A full week: the bump starts once the new dot has popped, then crosses the dots. */
const WAVE_START_MS = 420;
const WAVE_STAGGER_MS = 70;

/**
 * One week dot. `celebrateKey` fills it with a springy pop and two soft green rings;
 * `waveKey` gives it a small staggered bump when the whole week is done.
 */
function WeekDot({
  filled,
  celebrateKey,
  waveKey,
  waveDelay,
}: {
  filled: boolean;
  celebrateKey: number | null;
  waveKey: number | null;
  waveDelay: number;
}) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const fill = useSharedValue(filled ? 1 : 0);
  const scale = useSharedValue(1);
  const ringA = useSharedValue(0);
  const ringB = useSharedValue(0);

  useEffect(() => {
    if (celebrateKey != null) {
      return;
    }
    if (filled) {
      fill.set(1);
      return;
    }
    // Going down (a deleted workout, a new week) just crossfades back to grey: no ceremony.
    // It is a color fade, so it plays under Reduce Motion too.
    fill.set(
      withTiming(0, { duration: DURATION.change, easing: EASE_OUT, reduceMotion: ReduceMotion.Never }),
    );
  }, [celebrateKey, fill, filled]);

  useEffect(() => {
    if (celebrateKey == null) {
      return;
    }
    // A color crossfade is the reduced-motion celebration: it must still play (not jump).
    fill.set(
      withTiming(1, {
        duration: reduceMotion ? DURATION.change : DURATION.fade,
        easing: EASE_OUT,
        reduceMotion: ReduceMotion.Never,
      }),
    );
    if (reduceMotion) {
      return;
    }
    scale.set(0.5);
    scale.set(withSpring(1, SPRING.pop));
    ringA.set(0);
    ringA.set(withTiming(1, { duration: DURATION.celebrate, easing: EASE_OUT }));
    ringB.set(0);
    ringB.set(
      withDelay(RING_STAGGER_MS, withTiming(1, { duration: DURATION.celebrate, easing: EASE_OUT })),
    );
  }, [celebrateKey, fill, reduceMotion, ringA, ringB, scale]);

  useEffect(() => {
    if (waveKey == null || reduceMotion) {
      return;
    }
    scale.set(
      withDelay(
        WAVE_START_MS + waveDelay,
        withSequence(
          withTiming(1.35, { duration: DURATION.press, easing: EASE_OUT }),
          withSpring(1, SPRING.settle),
        ),
      ),
    );
  }, [reduceMotion, scale, waveDelay, waveKey]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
    backgroundColor: interpolateColor(fill.get(), [0, 1], [colors.systemGray5, colors.systemGreen]),
  }));
  const ringAStyle = useAnimatedStyle(() => ({
    opacity: ringA.get() === 0 ? 0 : 0.45 * (1 - ringA.get()),
    transform: [{ scale: 1 + ringA.get() * 2.4 }],
  }));
  const ringBStyle = useAnimatedStyle(() => ({
    opacity: ringB.get() === 0 ? 0 : 0.45 * (1 - ringB.get()),
    transform: [{ scale: 1 + ringB.get() * 2.4 }],
  }));

  const ring = {
    position: 'absolute' as const,
    width: DOT,
    height: DOT,
    borderRadius: radius.full,
    backgroundColor: colors.systemGreen,
  };

  return (
    <View style={{ width: DOT, height: DOT }}>
      <Animated.View pointerEvents="none" style={[ring, ringAStyle]} />
      <Animated.View pointerEvents="none" style={[ring, ringBStyle]} />
      <Animated.View style={[{ width: DOT, height: DOT, borderRadius: radius.full }, dotStyle]} />
    </View>
  );
}
